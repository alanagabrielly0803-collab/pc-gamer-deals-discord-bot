import { fetchMercadoLivreDeals } from '../sources/mercadolivre.js';
import { fetchKabumDeals } from '../sources/kabum.js';
import { fetchKalungaDeals } from '../sources/kalunga.js';
import { fetchTerabyteDeals } from '../sources/terabyte.js';

import { normalizeDeal } from './normalizeDeal.js';
import { evaluateDeal, isValidDeal } from './validateDeal.js';
import { dedupeDeals } from '../utils/dedupe.js';
import { annotateBestPriceDeals } from '../utils/priceComparison.js';
import { verifyProductPage } from '../utils/pageHealth.js';

import { enrichWithPriceTracking, rememberUrlHealth, saveSeenDeals, readDb } from '../storage/jsonStore.js';
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

function getUrlHealthKey(deal) {
  return String(deal?.canonicalUrl || deal?.productUrl || '').trim() || null;
}

function isFreshEntry(entry, maxAgeMs) {
  if (!entry || !entry.state || !entry.checkedAt) return false;

  const checkedAt = new Date(entry.checkedAt).getTime();
  if (Number.isNaN(checkedAt)) return false;

  return Date.now() - checkedAt <= maxAgeMs;
}

async function filterLiveDeals(deals) {
  const db = await readDb();
  const cachedHealth = db.urlHealth || {};
  const deadFreshnessMs = 7 * 24 * 60 * 60 * 1000;
  const liveDeals = [];
  const healthEntries = [];

  for (const deal of deals) {
    const healthKey = getUrlHealthKey(deal);
    const cached = healthKey ? cachedHealth[healthKey] : null;

    if (cached?.state === 'dead' && isFreshEntry(cached, deadFreshnessMs)) {
      logger.info(
        `[page-health] cached dead URL skipped: ${deal.productName} -> ${healthKey} (${cached.reason || 'unknown'})`
      );
      continue;
    }

    const verdict = await verifyProductPage(deal.productUrl);

    if (verdict.ok) {
      liveDeals.push(deal);
      continue;
    }

    healthEntries.push({
      canonicalUrl: healthKey,
      finalUrl: verdict.finalUrl,
      state: 'dead',
      reason: verdict.reason,
      status: verdict.status,
      checkedAt: verdict.checkedAt
    });

    logger.info(
      `[page-health] dropped dead URL: ${deal.productName} -> ${healthKey} (${verdict.reason || 'unknown'})`
    );
  }

  await rememberUrlHealth(healthEntries.filter((entry) => entry.canonicalUrl));

  return liveDeals;
}

export async function findDeals() {
  const fetchers = [
    ['Mercado Livre', fetchMercadoLivreDeals],
    ['Kabum', fetchKabumDeals],
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
  const featured = selectFeaturedDeals(
    compared.filter((deal) => evaluateDeal(deal).accepted),
    20
  );
  const valid = await filterLiveDeals(featured);

  await saveSeenDeals(valid);

  logger.info(`Deals summary: raw=${raw.length}, valid=${valid.length}, unique=${unique.length}`);

  return valid;
}
