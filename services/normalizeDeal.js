import { cleanText } from '../utils/text.js';
import { safeUrl, canonicalUrl, normalizeImageUrl } from '../utils/url.js';
import { parsePrice, discountPercent, formatBRL } from '../utils/price.js';
import { buildDealIdentity } from '../utils/dedupe.js';

export function timeRemaining(endDate) {
  if (!endDate) return null;

  const end = new Date(endDate).getTime();
  if (Number.isNaN(end)) return null;

  const diff = end - Date.now();
  if (diff <= 0) return 'Expired or ending soon';

  const hours = Math.floor(diff / 36e5);
  const days = Math.floor(hours / 24);
  const restHours = hours % 24;

  if (days > 0) return `${days}d ${restHours}h`;
  return `${hours}h`;
}

export function normalizeDeal(raw) {
  const current = parsePrice(raw.currentPrice);
  const original = parsePrice(raw.originalPrice);
  const computedDiscount = raw.discountPercent ?? discountPercent(original, current);

  const deal = {
    externalId: cleanText(raw.externalId, 180),
    productName: cleanText(raw.productName || raw.title, 180),
    imageUrl: normalizeImageUrl(raw.imageUrl),
    storeName: cleanText(raw.storeName || raw.store, 80),
    category: cleanText(raw.category, 80),

    currentPrice: current,
    currentPriceText: current !== null ? formatBRL(current) : cleanText(raw.currentPrice, 80),

    originalPrice: original,
    originalPriceText: original !== null ? formatBRL(original) : cleanText(raw.originalPrice, 80),

    discountPercent: Number.isFinite(Number(computedDiscount)) ? Number(computedDiscount) : null,

    couponCode: cleanText(raw.couponCode, 80),
    paymentDetails: cleanText(raw.paymentDetails, 180),
    installmentPrice: cleanText(raw.installmentPrice, 120),
    stockStatus: cleanText(raw.stockStatus, 80),

    productUrl: safeUrl(raw.productUrl || raw.url),
    canonicalUrl: canonicalUrl(raw.productUrl || raw.url),

    dealEndsAt: raw.dealEndsAt || null,
    timeRemaining: timeRemaining(raw.dealEndsAt),

    brand: cleanText(raw.brand, 80),
    model: cleanText(raw.model, 120),
    specs: cleanText(raw.specs, 500),
    shippingInfo: cleanText(raw.shippingInfo, 160),

    rating: cleanText(raw.rating, 40),
    reviewCount: cleanText(raw.reviewCount, 60),

    isFlashSale: Boolean(raw.isFlashSale),
    foundAt: raw.foundAt || new Date().toISOString(),

    description: cleanText(raw.description, 700),
    source: cleanText(raw.source || raw.storeName || 'Unknown', 120)
  };

  const identity = buildDealIdentity(deal);
    deal.storeSlug = identity.storeSlug;
    deal.titleSlug = identity.titleSlug;
    deal.comparisonKey = identity.comparisonKey;
    deal.productKey = identity.productKey;
    deal.dealKey = identity.dealKey;
    deal.urlKey = identity.urlKey;
  deal.uniqueKey = identity.urlKey || identity.dealKey;

  return deal;
}
