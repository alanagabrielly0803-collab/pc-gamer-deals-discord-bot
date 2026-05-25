import { config } from '../config.js';
import { containsAny } from '../utils/text.js';
import { isLikelyProductPage } from '../utils/url.js';
import { parsePrice } from '../utils/price.js';

const forbiddenTitlePatterns = [
  /^home$/i,
  /^ofertas?$/i,
  /^promoções?$/i,
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

export function isValidDeal(deal) {
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

  if (containsAny(deal.productName, config.excludeKeywords)) {
    return false;
  }

  const textForCategory = `${deal.productName} ${deal.category || ''} ${deal.specs || ''}`;

  if (config.includeKeywords.length > 0 && !containsAny(textForCategory, config.includeKeywords)) {
    return false;
  }

  const hasDiscount =
    deal.discountPercent !== null &&
    Number.isFinite(Number(deal.discountPercent)) &&
    Number(deal.discountPercent) >= config.minDiscountPercent;

  const hasPriceDrop = Boolean(deal.priceDropText);

  if (!hasDiscount && !hasPriceDrop) {
    return false;
  }

  const stock = String(deal.stockStatus || '').toLowerCase();
  if (stock.includes('indisponível') || stock.includes('indisponivel') || stock.includes('out of stock') || stock.includes('esgotado')) {
    return false;
  }

  return true;
}
