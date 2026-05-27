import { config } from '../config.js';
import {
  hasContextualSupport,
  matchesBlockedKeyword,
  matchesContextualKeyword,
  matchesStrongKeyword,
  STRONG_CATEGORIES,
  CONTEXTUAL_CATEGORIES,
  EXCLUDE_KEYWORDS
} from '../utils/dealTaxonomy.js';
import { containsAny, normalizeForSearch } from '../utils/text.js';
import { isLikelyProductPage } from '../utils/url.js';
import { parsePrice } from '../utils/price.js';

const forbiddenTitlePatterns = [
  /^home$/i,
  /^ofertas?$/i,
  /^promocoes?$/i,
  /^busca$/i,
  /^search$/i,
  /^categoria$/i,
  /^departamento$/i,
  /^carrinho$/i,
  /^login$/i,
  /^black friday$/i
];

const forbiddenUrlPatterns = [
  /\/search\b/i,
  /\/busca\b/i,
  /\/categoria\b/i,
  /\/departamento\b/i,
  /\/blog\b/i,
  /\/news\b/i,
  /\/login\b/i,
  /\/cart\b/i,
  /\/carrinho\b/i
];

function getTextForMatching(deal) {
  return [
    deal?.productName,
    deal?.category,
    deal?.specs,
    deal?.description,
    deal?.storeName,
    deal?.brand,
    deal?.model
  ]
    .filter(Boolean)
    .join(' ');
}

function getConfidence({ strongMatch, contextualMatch, discountPercent, categorySignal }) {
  if (strongMatch && discountPercent >= config.minDiscountPercent && categorySignal) {
    return 'high';
  }

  if (strongMatch && discountPercent >= config.minDiscountPercent) {
    return 'high';
  }

  if ((strongMatch || contextualMatch) && (discountPercent >= config.minDiscountPercent || categorySignal)) {
    return 'medium';
  }

  return 'low';
}

export function evaluateDeal(deal, options = {}) {
  const allowWithoutDiscount = Boolean(options.allowWithoutDiscount);

  if (!deal) {
    return { accepted: false, confidence: 'low', reason: 'missing_deal' };
  }

  if (!deal.productName || deal.productName.length < 5) {
    return { accepted: false, confidence: 'low', reason: 'missing_product_name' };
  }

  if (!deal.productUrl) {
    return { accepted: false, confidence: 'low', reason: 'missing_product_url' };
  }

  if (!deal.storeName) {
    return { accepted: false, confidence: 'low', reason: 'missing_store_name' };
  }

  if (forbiddenTitlePatterns.some((pattern) => pattern.test(deal.productName))) {
    return { accepted: false, confidence: 'low', reason: 'forbidden_title_pattern' };
  }

  if (forbiddenUrlPatterns.some((pattern) => pattern.test(deal.productUrl))) {
    return { accepted: false, confidence: 'low', reason: 'forbidden_url_pattern' };
  }

  if (!isLikelyProductPage(deal.productUrl)) {
    return { accepted: false, confidence: 'low', reason: 'not_product_page' };
  }

  const currentPrice = parsePrice(deal.currentPrice);
  if (currentPrice === null || currentPrice <= 0) {
    return { accepted: false, confidence: 'low', reason: 'invalid_current_price' };
  }

  if (config.maxPrice !== null && currentPrice > config.maxPrice) {
    return { accepted: false, confidence: 'low', reason: 'price_above_max' };
  }

  const normalizedTitle = normalizeForSearch(deal.productName);
  const textForMatching = getTextForMatching(deal);

  if (
    containsAny(normalizedTitle, EXCLUDE_KEYWORDS) ||
    matchesBlockedKeyword(textForMatching)
  ) {
    return { accepted: false, confidence: 'low', reason: 'blocked_keyword' };
  }

  const category = normalizeForSearch(deal.category);
  const hasStrongCategory = containsAny(category, STRONG_CATEGORIES);
  const hasContextualCategory = containsAny(category, CONTEXTUAL_CATEGORIES);
  const hasStrongKeyword = matchesStrongKeyword(textForMatching);
  const hasContextualKeyword = matchesContextualKeyword(normalizedTitle);
  const hasContextSupport = hasContextualSupport(textForMatching);

  const strongMatch = hasStrongKeyword || hasStrongCategory;
  const contextualMatch = hasContextualKeyword && hasContextSupport;
  const categorySignal = hasStrongCategory || hasContextualCategory;
  const hasRelevantSignal = strongMatch || contextualMatch;

  if (!hasRelevantSignal) {
    return { accepted: false, confidence: 'low', reason: 'no_relevant_signal' };
  }

  const hasDiscount =
    deal.discountPercent !== null &&
    Number.isFinite(Number(deal.discountPercent)) &&
    Number(deal.discountPercent) >= config.minDiscountPercent;
  const hasPriceDrop = Boolean(deal.priceDropText);

  if (!hasDiscount && !hasPriceDrop && !allowWithoutDiscount) {
    return {
      accepted: false,
      confidence: getConfidence({
        strongMatch,
        contextualMatch,
        discountPercent: Number(deal.discountPercent) || 0,
        categorySignal
      }),
      reason: 'discount_below_threshold'
    };
  }

  const stock = String(deal.stockStatus || '').toLowerCase();
  if (
    stock.includes('indisponivel') ||
    stock.includes('out of stock') ||
    stock.includes('esgotado')
  ) {
    return { accepted: false, confidence: 'low', reason: 'out_of_stock' };
  }

  return {
    accepted: true,
    confidence: getConfidence({
      strongMatch,
      contextualMatch,
      discountPercent: Number(deal.discountPercent) || 0,
      categorySignal
    }),
    reason: strongMatch
      ? 'matched_strong_category_and_signal'
      : contextualMatch
        ? 'matched_contextual_keyword_with_context'
        : 'matched_category_signal'
  };
}

export function isValidDeal(deal, options = {}) {
  return evaluateDeal(deal, options).accepted;
}
