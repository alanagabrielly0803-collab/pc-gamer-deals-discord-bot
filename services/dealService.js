import { fetchMercadoLivreDeals } from '../sources/mercadolivre.js';
import { fetchKalungaDeals } from '../sources/kalunga.js';
import { fetchTerabyteDeals } from '../sources/terabyte.js';

import { normalizeDeal } from './normalizeDeal.js';
import { evaluateDeal, isValidDeal } from './validateDeal.js';
import { dedupeDeals } from '../utils/dedupe.js';
import { annotateBestPriceDeals } from '../utils/priceComparison.js';

import { enrichWithPriceTracking, saveSeenDeals } from '../storage/jsonStore.js';
import { logger } from '../utils/logger.js';
import { parsePrice } from '../utils/price.js';

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

function normalizeCategory(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function getDealPrice(deal) {
  const price = parsePrice(deal?.currentPrice);
  return price === null ? Number.POSITIVE_INFINITY : price;
}

function compareFeaturedDeals(a, b) {
  const confidenceOrder = { high: 3, medium: 2, low: 1 };
  const confidenceA = confidenceOrder[a?.validationConfidence] || 0;
  const confidenceB = confidenceOrder[b?.validationConfidence] || 0;

  if (confidenceA !== confidenceB) return confidenceB - confidenceA;

  const discountA = Number.isFinite(Number(a?.discountPercent)) ? Number(a.discountPercent) : -1;
  const discountB = Number.isFinite(Number(b?.discountPercent)) ? Number(b.discountPercent) : -1;

  if (discountA !== discountB) return discountB - discountA;

  const priceA = getDealPrice(a);
  const priceB = getDealPrice(b);
  if (priceA !== priceB) return priceA - priceB;

  const comparisonA = Boolean(a?.isBestPriceComparison);
  const comparisonB = Boolean(b?.isBestPriceComparison);
  if (comparisonA !== comparisonB) return comparisonB - comparisonA;

  return String(a?.storeName || '').localeCompare(String(b?.storeName || ''));
}

function selectFeaturedDeals(deals, limit) {
  const byCategory = new Map();

  for (const deal of deals) {
    const categoryKey = normalizeCategory(deal.category || 'uncategorized');
    if (!byCategory.has(categoryKey)) {
      byCategory.set(categoryKey, []);
    }
    byCategory.get(categoryKey).push(deal);
  }

  const featured = [];

  for (const group of byCategory.values()) {
    const discounted = group.filter((deal) => isValidDeal(deal));
    const comparison = group.filter((deal) => isValidDeal(deal) && deal.isBestPriceComparison);

    let winner = null;

    if (discounted.length > 0) {
      discounted.sort(compareFeaturedDeals);
      winner = discounted[0];
    } else if (comparison.length > 0) {
      comparison.sort(compareFeaturedDeals);
      winner = comparison[0];
    } else {
      const priced = [...group].sort(compareFeaturedDeals);
      winner = priced[0] || null;
    }

    if (winner) {
      featured.push(winner);
    }
  }

  featured.sort(compareFeaturedDeals);
  return featured.slice(0, Math.max(1, limit));
}

export async function findDeals() {
  const fetchers = [
    ['Mercado Livre', fetchMercadoLivreDeals],
    ['Kalunga', fetchKalungaDeals],
    ['Terabyte', fetchTerabyteDeals]
  ];

  const raw = [];

  for (const [name, fn] of fetchers) {
    raw.push(...(await safeFetch(name, fn)));
  }

  const normalized = raw.map(normalizeDeal);
  const withTracking = await enrichWithPriceTracking(normalized);
  const candidates = withTracking
    .map((deal) => {
      const assessment = evaluateDeal(deal, { allowWithoutDiscount: true });
      return assessment.accepted
        ? {
            ...deal,
            validationConfidence: assessment.confidence,
            validationReason: assessment.reason
          }
        : null;
    })
    .filter(Boolean);
  const unique = dedupeDeals(candidates);
  const compared = annotateBestPriceDeals(unique);
  const valid = selectFeaturedDeals(
    compared.filter((deal) => evaluateDeal(deal).accepted),
    20
  );

  await saveSeenDeals(valid);

  logger.info(`Deals summary: raw=${raw.length}, valid=${valid.length}, unique=${unique.length}`);

  return valid;
}
