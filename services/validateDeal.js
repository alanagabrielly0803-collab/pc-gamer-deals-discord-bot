import { config } from '../config.js';
import { RELEVANT_PRODUCT_HINTS } from '../utils/dealTaxonomy.js';
import { containsAny } from '../utils/text.js';
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

export function isValidDeal(deal, options = {}) {
  const allowWithoutDiscount = Boolean(options.allowWithoutDiscount);

  if (!deal) return false;

  if (!deal.productName || deal.productName.length < 5) return false;
  if (!deal.productUrl) return false;
  if (!deal.storeName) return false;

  if (forbiddenTitlePatterns.some((pattern) => pattern.test(deal.productName))) {
    return false;
  }

  if (forbiddenUrlPatterns.some((pattern) => pattern.test(deal.productUrl))) {
    return false;
  }

  if (!isLikelyProductPage(deal.productUrl)) {
    return false;
  }

  const currentPrice = parsePrice(deal.currentPrice);
  if (currentPrice === null || currentPrice <= 0) return false;

  if (config.maxPrice !== null && currentPrice > config.maxPrice) {
    return false;
  }

  const textForMatching = `${deal.productName} ${deal.category || ''} ${deal.specs || ''} ${deal.description || ''} ${deal.storeName || ''}`;

  if (containsAny(deal.productName, config.excludeKeywords)) {
    return false;
  }

  const hasConfiguredKeyword = config.includeKeywords.length > 0 && containsAny(textForMatching, config.includeKeywords);
  const hasMonitoredCategory = config.monitoredCategories.length > 0 && containsAny(deal.category || '', config.monitoredCategories);
  const hasRelevantHint = containsAny(textForMatching, RELEVANT_PRODUCT_HINTS);
  const hasRelevantSignal = hasConfiguredKeyword || hasMonitoredCategory || hasRelevantHint;

  if (!hasRelevantSignal) {
    return false;
  }

  const hasDiscount =
    deal.discountPercent !== null &&
    Number.isFinite(Number(deal.discountPercent)) &&
    deal.discountPercent >= config.minDiscountPercent;

  if (!hasDiscount && !allowWithoutDiscount) {
    return false;
  }

  const stock = String(deal.stockStatus || '').toLowerCase();
  if (
    stock.includes('indisponivel') ||
    stock.includes('out of stock') ||
    stock.includes('esgotado')
  ) {
    return false;
  }

  return true;
}
