import { config } from '../config.js';

import { fetchMercadoLivreDeals } from '../sources/mercadolivre.js';
import { fetchAmazonDeals } from '../sources/amazon.js';
import { fetchAliExpressDeals } from '../sources/aliexpress.js';
import { fetchShopeeDeals } from '../sources/shopee.js';
import { fetchKabumDealsExperimental } from '../sources/kabum.js';
import { fetchTerabyteDealsExperimental } from '../sources/terabyte.js';
import { fetchPichauDealsExperimental } from '../sources/pichau.js';
import { fetchMagaluDealsExperimental } from '../sources/magalu.js';

import { normalizeDeal } from './normalizeDeal.js';
import { isValidDeal } from './validateDeal.js';
import { dedupeDeals } from '../utils/dedupe.js';

import { enrichWithPriceTracking, saveSeenDeals } from '../storage/jsonStore.js';
import { logger } from '../utils/logger.js';

async function safeFetch(name, fn) {
  try {
    const results = await fn();
    logger.info(`${name}: ${results.length} raw result(s)`);
    return results;
  } catch (error) {
    logger.error(`${name} failed`, error);
    return [];
  }
}

export async function findDeals() {
  const fetchers = [
    ['Mercado Livre', fetchMercadoLivreDeals],
    ['Amazon', fetchAmazonDeals],
    ['AliExpress', fetchAliExpressDeals],
    ['Shopee', fetchShopeeDeals]
  ];

  if (config.enableExperimentalScraping) {
    fetchers.push(['Kabum Experimental', fetchKabumDealsExperimental]);
    fetchers.push(['Terabyte Experimental', fetchTerabyteDealsExperimental]);
    fetchers.push(['Pichau Experimental', fetchPichauDealsExperimental]);
    fetchers.push(['Magalu Experimental', fetchMagaluDealsExperimental]);
  } else {
    logger.info('Experimental scraping disabled. Kabum, Terabyte, Pichau and Magalu scraping will not run.');
  }

  const raw = [];

  for (const [name, fn] of fetchers) {
    raw.push(...(await safeFetch(name, fn)));
  }

  const normalized = raw.map(normalizeDeal);
  const withTracking = await enrichWithPriceTracking(normalized);
  const valid = withTracking.filter(isValidDeal);
  const unique = dedupeDeals(valid);

  await saveSeenDeals(unique);

  logger.info(`Deals summary: raw=${raw.length}, valid=${valid.length}, unique=${unique.length}`);

  return unique;
}
