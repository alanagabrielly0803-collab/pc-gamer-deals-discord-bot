import { config } from '../config.js';
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

const accessoryHints = [
  'teclado',
  'teclado mecanico',
  'mouse',
  'mouse sem fio',
  'mouse wireless',
  'headset',
  'headset sem fio',
  'fone',
  'fone sem fio',
  'mousepad',
  'desk mat',
  'microfone',
  'microfone usb',
  'webcam',
  'controle',
  'controle xbox',
  'controle playstation',
  'volante',
  'hub usb',
  'usb hub',
  'capture card',
  'placa de captura',
  'cadeira gamer',
  'mesa gamer',
  'suporte para headset',
  'braco articulado',
  'stream deck',
  'ring light',
  'mouse bungee',
  'paracord mouse',
  'carregador sem fio',
  'base carregamento',
  'cabo usb',
  'cabo usb c',
  'gamer accessory',
  'gaming accessory',
  'peripheral',
  'peripherals'
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

  const textForMatching = `${deal.productName} ${deal.category || ''} ${deal.specs || ''} ${deal.description || ''} ${deal.storeName || ''}`;

  if (containsAny(deal.productName, config.excludeKeywords)) {
    return false;
  }

  const hasConfiguredKeyword = config.includeKeywords.length > 0 && containsAny(textForMatching, config.includeKeywords);
  const hasMonitoredCategory = config.monitoredCategories.length > 0 && containsAny(deal.category || '', config.monitoredCategories);
  const hasAccessoryHint = containsAny(textForMatching, accessoryHints);
  const hasRelevantSignal = hasConfiguredKeyword || hasMonitoredCategory || hasAccessoryHint;

  if (!hasRelevantSignal) {
    return false;
  }

  const isMarketplaceFallback =
    /mercado livre/i.test(String(deal.storeName || '')) ||
    /html search fallback/i.test(String(deal.source || '')) ||
    /public search api/i.test(String(deal.source || ''));

  const hasDiscount =
    deal.discountPercent !== null &&
    Number.isFinite(Number(deal.discountPercent)) &&
    deal.discountPercent >= config.minDiscountPercent;

  const hasPriceDrop = Boolean(deal.priceDropText);
  const hasPromotionSignal = Boolean(deal.isFlashSale);

  if (!hasDiscount && !hasPriceDrop && !hasPromotionSignal) {
    if (!isMarketplaceFallback) {
      return false;
    }

    const titleLooksRelevant = containsAny(
      textForMatching,
      [...config.includeKeywords, ...accessoryHints]
    );

    if (!titleLooksRelevant) {
      return false;
    }
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
