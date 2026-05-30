import { config } from '../config.js';
import { fetchMercadoLivreDeals } from '../sources/mercadolivre.js';
import { fetchKabumDeals } from '../sources/kabum.js';
import { fetchKalungaDeals } from '../sources/kalunga.js';
import { fetchTerabyteDeals } from '../sources/terabyte.js';
import { fetchShopeeDeals } from '../sources/shopee.js';
import { fetchPublicShopeeDeals } from '../sources/publicShopee.js';

import { normalizeDeal } from './normalizeDeal.js';
import { evaluateDeal } from './validateDeal.js';
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

function getEnabledFetchers() {
  const flags = config.sourceFlags || {};
  const fetchers = [
    ['Mercado Livre', fetchMercadoLivreDeals, flags.mercadoLivre === true],
    ['Kabum', fetchKabumDeals, flags.kabum !== false],
    ['Kalunga', fetchKalungaDeals, flags.kalunga !== false],
    ['Terabyte', fetchTerabyteDeals, flags.terabyte !== false],
    ['Shopee', fetchShopeeDeals, flags.shopee !== false],
    ['Public Shopee', fetchPublicShopeeDeals, flags.publicShopee !== false]
  ];

  for (const [name, _fn, enabled] of fetchers) {
    if (!enabled) logger.info(`${name}: disabled by config`);
  }

  return fetchers.filter(([, , enabled]) => enabled).map(([name, fn]) => [name, fn]);
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
  const imageA = a?.imageUrl ? 1 : 0;
  const imageB = b?.imageUrl ? 1 : 0;
  if (imageA !== imageB) return imageB - imageA;

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
  const sorted = [...deals].sort(compareFeaturedDeals);
  const selected = [];
  const byStore = new Map();
  const byCategory = new Map();

  for (const deal of sorted) {
    if (selected.length >= Math.max(1, limit)) break;

    const storeKey = normalizeCategory(deal.storeName || 'unknown');
    const categoryKey = normalizeCategory(deal.category || 'uncategorized');
    const storeCount = byStore.get(storeKey) || 0;
    const categoryCount = byCategory.get(categoryKey) || 0;

    if (storeCount >= config.maxPostsPerStore) continue;
    if (categoryCount >= config.maxPostsPerCategory) continue;
    if (config.requireImageForPost && !deal.imageUrl) continue;

    selected.push(deal);
    byStore.set(storeKey, storeCount + 1);
    byCategory.set(categoryKey, categoryCount + 1);
  }

  if (selected.length < Math.max(1, limit)) {
    for (const deal of sorted) {
      if (selected.length >= Math.max(1, limit)) break;
      if (selected.includes(deal)) continue;
      if (config.requireImageForPost && !deal.imageUrl) continue;
      selected.push(deal);
    }
  }

  return selected;
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

function applyProductPageEnrichment(deal, verdict) {
  const enriched = { ...deal };

  if (verdict.imageUrl) {
    enriched.imageUrl = verdict.imageUrl;
    enriched.imageSource = 'product_page';
  }

  if (verdict.productTitle) {
    enriched.pageProductTitle = verdict.productTitle;
  }

  if (verdict.finalUrl) {
    enriched.finalUrl = verdict.finalUrl;
  }

  return enriched;
}

async function filterLiveDeals(deals) {
  const db = await readDb();
  const cachedHealth = db.urlHealth || {};
  const deadFreshnessMs = 7 * 24 * 60 * 60 * 1000;
  const liveDeals = [];
  const healthEntries = [];
  let withoutImage = 0;

  for (const deal of deals) {
    if (deal.skipPageHealth) {
      if (!deal.imageUrl) withoutImage += 1;
      liveDeals.push(deal);
      continue;
    }

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
      const enriched = applyProductPageEnrichment(deal, verdict);
      if (!enriched.imageUrl) withoutImage += 1;
      liveDeals.push(enriched);
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

  logger.info(`[page-health] live=${liveDeals.length}, withoutImage=${withoutImage}, dropped=${healthEntries.length}`);

  return liveDeals;
}

function summarizeByStore(deals) {
  const counts = new Map();
  for (const deal of deals) {
    const key = deal.storeName || 'Unknown';
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return [...counts.entries()].map(([store, total]) => `${store}=${total}`).join(', ');
}

function canContinueWithoutDiscount(deal) {
  return ['mercado livre', 'shopee'].includes(String(deal?.storeName || '').toLowerCase());
}

function evaluateForFinalSelection(deal) {
  const normal = evaluateDeal(deal);
  if (normal.accepted) return normal;

  if (normal.reason !== 'discount_below_threshold' || !canContinueWithoutDiscount(deal)) {
    return normal;
  }

  const relaxed = evaluateDeal(deal, { allowWithoutDiscount: true });
  return relaxed.accepted
    ? {
        ...relaxed,
        confidence: relaxed.confidence === 'high' ? 'medium' : relaxed.confidence,
        reason: `${String(deal.storeName || 'store').toLowerCase().replace(/\s+/g, '_')}_without_original_price`
      }
    : normal;
}

export async function findDeals() {
  const fetchers = getEnabledFetchers();
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
  const finalCandidates = compared
    .map((deal) => {
      const assessment = evaluateForFinalSelection(deal);
      return assessment.accepted
        ? {
            ...deal,
            validationConfidence: assessment.confidence,
            validationReason: assessment.reason
          }
        : null;
    })
    .filter(Boolean);
  const candidateLimit = Math.max(config.maxCandidatesPerCheck, config.maxPostsPerCheck);
  const balancedCandidates = selectFeaturedDeals(finalCandidates, candidateLimit);
  const valid = await filterLiveDeals(balancedCandidates);
  const featured = selectFeaturedDeals(valid, config.maxPostsPerCheck);

  await saveSeenDeals(featured);

  logger.info(
    `Deals summary: raw=${raw.length}, candidates=${candidates.length}, unique=${unique.length}, finalCandidates=${finalCandidates.length}, live=${valid.length}, selected=${featured.length}`
  );
  logger.info(`Deals by store: raw=[${summarizeByStore(normalized)}], selected=[${summarizeByStore(featured)}]`);

  return featured;
}
