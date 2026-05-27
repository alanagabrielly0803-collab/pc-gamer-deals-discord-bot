import { parsePrice, formatBRL } from './price.js';

function getComparisonKey(deal) {
  return String(deal?.comparisonKey || deal?.productKey || deal?.titleSlug || deal?.productName || '').trim();
}

export function annotateBestPriceDeals(deals) {
  const groups = new Map();

  for (const deal of deals) {
    const key = getComparisonKey(deal);
    if (!key) continue;

    if (!groups.has(key)) {
      groups.set(key, []);
    }

    groups.get(key).push(deal);
  }

  for (const [key, group] of groups.entries()) {
    const priced = group
      .map((deal) => ({
        deal,
        price: parsePrice(deal.currentPrice)
      }))
      .filter((item) => item.price !== null);

    priced.sort((a, b) => {
      if (a.price !== b.price) return a.price - b.price;

      const discountA = Number.isFinite(Number(a.deal.discountPercent)) ? Number(a.deal.discountPercent) : -1;
      const discountB = Number.isFinite(Number(b.deal.discountPercent)) ? Number(b.deal.discountPercent) : -1;

      if (discountA !== discountB) return discountB - discountA;

      return String(a.deal.storeName || '').localeCompare(String(b.deal.storeName || ''));
    });

    const bestPrice = priced[0];
    if (!bestPrice) continue;

    const bestPriceValue = bestPrice.price;
    const groupLabel = group.length === 1 ? 'oferta' : 'ofertas semelhantes';
    const bestPriceText = `Menor preço encontrado entre ${group.length} ${groupLabel}: ${formatBRL(bestPriceValue)}`;

    for (const deal of group) {
      deal.comparisonKey = key;
      deal.comparisonGroupSize = group.length;
      deal.comparisonBestPrice = bestPriceValue;
      deal.isBestPriceComparison = deal === bestPrice.deal;

      if (deal.isBestPriceComparison) {
        deal.comparisonText = bestPriceText;
      }
    }
  }

  return deals;
}
