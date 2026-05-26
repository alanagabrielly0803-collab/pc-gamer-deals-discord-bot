import { fetchMercadoLivreDeals } from '../sources/mercadolivre.js';
import { fetchKalungaDeals } from '../sources/kalunga.js';

import { normalizeDeal } from './normalizeDeal.js';
import { isValidDeal } from './validateDeal.js';
import { dedupeDeals } from '../utils/dedupe.js';
import { annotateBestPriceDeals } from '../utils/priceComparison.js';

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
    ['Kalunga', fetchKalungaDeals]
  ];

  const raw = [];

  for (const [name, fn] of fetchers) {
    raw.push(...(await safeFetch(name, fn)));
  }

  const normalized = raw.map(normalizeDeal);
  const withTracking = await enrichWithPriceTracking(normalized);
  const candidates = withTracking.filter((deal) => isValidDeal(deal, { allowWithoutDiscount: true }));
  const unique = dedupeDeals(candidates);
  const compared = annotateBestPriceDeals(unique);
  const valid = compared.filter((deal) => isValidDeal(deal) || deal.isBestPriceComparison);

  await saveSeenDeals(valid);

  logger.info(`Deals summary: raw=${raw.length}, valid=${valid.length}, unique=${unique.length}`);

  return valid;
}
