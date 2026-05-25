import { slugify } from './text.js';
import { canonicalUrl } from './url.js';
import { parsePrice } from './price.js';

export function buildDealIdentity(deal) {
  const storeSlug = slugify(deal.storeName || deal.store || 'unknown');
  const titleSlug = slugify(deal.productName || deal.title || '');
  const url = canonicalUrl(deal.productUrl || deal.url);
  const price = parsePrice(deal.currentPrice);

  return {
    storeSlug,
    titleSlug,
    canonicalUrl: url,
    priceKey: price === null ? 'unknown' : String(price),
    productKey: `${storeSlug}:${titleSlug}`,
    dealKey: `${storeSlug}:${titleSlug}:${price === null ? 'unknown' : price}`,
    urlKey: url ? `url:${url}:${price === null ? 'unknown' : price}` : null
  };
}

export function areSameProduct(a, b) {
  const ai = buildDealIdentity(a);
  const bi = buildDealIdentity(b);

  if (ai.canonicalUrl && bi.canonicalUrl && ai.canonicalUrl === bi.canonicalUrl) {
    return true;
  }

  if (ai.storeSlug === bi.storeSlug && ai.titleSlug === bi.titleSlug) {
    return true;
  }

  return ai.storeSlug === bi.storeSlug && areSimilarTitles(ai.titleSlug, bi.titleSlug);
}

export function areSameDeal(a, b) {
  const ai = buildDealIdentity(a);
  const bi = buildDealIdentity(b);

  if (ai.urlKey && bi.urlKey && ai.urlKey === bi.urlKey) return true;

  return areSameProduct(a, b) && ai.priceKey === bi.priceKey;
}

export function dedupeDeals(deals) {
  const unique = [];

  for (const deal of deals) {
    const duplicate = unique.find((item) => areSameDeal(item, deal));

    if (!duplicate) {
      unique.push(deal);
    } else {
      mergeDealData(duplicate, deal);
    }
  }

  return unique;
}

function mergeDealData(target, source) {
  const fields = [
    'productName', 'imageUrl', 'storeName', 'category', 'currentPrice',
    'originalPrice', 'discountPercent', 'couponCode', 'paymentDetails',
    'installmentPrice', 'stockStatus', 'productUrl', 'dealEndsAt',
    'brand', 'model', 'specs', 'shippingInfo', 'rating', 'reviewCount',
    'isFlashSale'
  ];

  for (const field of fields) {
    if (!target[field] && source[field]) target[field] = source[field];
  }

  if ((!target.description || target.description.length < 80) && source.description) {
    target.description = source.description;
  }

  const sources = new Set(String(target.source || '').split(', ').filter(Boolean));
  if (source.source) sources.add(source.source);
  target.source = [...sources].join(', ');
}

function areSimilarTitles(a, b) {
  if (!a || !b) return false;
  if (a === b) return true;

  if (a.length >= 10 && b.length >= 10 && (a.includes(b) || b.includes(a))) {
    return true;
  }

  const similarity = stringSimilarity(a, b);
  return similarity >= 0.88;
}

function stringSimilarity(a, b) {
  if (a === b) return 1;
  const distance = levenshteinDistance(a, b);
  const maxLength = Math.max(a.length, b.length);
  return maxLength === 0 ? 1 : 1 - distance / maxLength;
}

function levenshteinDistance(a, b) {
  const matrix = Array.from({ length: b.length + 1 }, (_, i) => [i]);

  for (let j = 0; j <= a.length; j += 1) matrix[0][j] = j;

  for (let i = 1; i <= b.length; i += 1) {
    for (let j = 1; j <= a.length; j += 1) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[b.length][a.length];
}
