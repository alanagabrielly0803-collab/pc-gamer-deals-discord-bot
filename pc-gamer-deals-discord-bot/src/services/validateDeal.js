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

const hardwareHints = [
  'pc gamer',
  'pc completo',
  'pc desktop',
  'pc montado',
  'kit gamer',
  'gabinete gamer',
  'notebook gamer',
  'teclado',
  'teclado mecanico',
  'mouse',
  'mouse sem fio',
  'headset',
  'headset sem fio',
  'monitor',
  'monitor ultrawide',
  'monitor 144hz',
  'monitor 165hz',
  'ssd',
  'ssd nvme',
  'ssd sata',
  'ssd 1tb',
  'ssd 2tb',
  'ram',
  'memoria ram',
  'memoria ddr4',
  'memoria ddr5',
  'placa',
  'placa de video rtx',
  'placa de video rx',
  'processador',
  'ryzen',
  'intel core',
  'fonte',
  'fonte modular',
  'gabinete',
  'cooler',
  'water cooler',
  'notebook',
  'desktop',
  'cadeira',
  'mousepad',
  'webcam',
  'microfone',
  'hub usb',
  'mesa gamer',
  'volante',
  'controle',
  'controle xbox',
  'controle playstation'
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
  const hasHardwareHint = containsAny(textForMatching, hardwareHints);
  const hasRelevantSignal = hasConfiguredKeyword || hasMonitoredCategory || hasHardwareHint;

  if (!hasRelevantSignal) {
    return false;
  }

  const hasDiscount =
    deal.discountPercent !== null &&
    Number.isFinite(Number(deal.discountPercent)) &&
    Number(deal.discountPercent) >= config.minDiscountPercent;

  const hasPriceDrop = Boolean(deal.priceDropText);
  const hasPromotionSignal = Boolean(deal.isFlashSale);

  if (!hasDiscount && !hasPriceDrop && !hasPromotionSignal) {
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
