import axios from 'axios';
import * as cheerio from 'cheerio';

function parseJsonLdProducts($) {
  const products = [];

  $('script[type="application/ld+json"]').each((_index, el) => {
    const raw = $(el).contents().text();

    try {
      const parsed = JSON.parse(raw);
      const nodes = Array.isArray(parsed) ? parsed : [parsed];

      for (const node of nodes) {
        collectProductNodes(node, products);
      }
    } catch {
      // Ignore invalid JSON-LD
    }
  });

  return products;
}

function collectProductNodes(node, products) {
  if (!node || typeof node !== 'object') return;

  if (node['@type'] === 'Product' || (Array.isArray(node['@type']) && node['@type'].includes('Product'))) {
    products.push(node);
  }

  for (const value of Object.values(node)) {
    if (Array.isArray(value)) {
      for (const item of value) collectProductNodes(item, products);
    } else if (value && typeof value === 'object') {
      collectProductNodes(value, products);
    }
  }
}

function absolutizeUrl(url, baseUrl) {
  if (!url) return null;

  try {
    return new URL(url, baseUrl).toString();
  } catch {
    return null;
  }
}

export async function scrapeProductList({ storeName, sourceUrl, category, userAgent = 'PCGamerDealsBot/1.0' }) {
  const { data: html } = await axios.get(sourceUrl, {
    timeout: 15000,
    headers: {
      'User-Agent': userAgent,
      'Accept': 'text/html,application/xhtml+xml'
    }
  });

  const $ = cheerio.load(html);
  const products = parseJsonLdProducts($);

  return products.map((product, index) => {
    const offer = Array.isArray(product.offers) ? product.offers[0] : product.offers;
    const image = Array.isArray(product.image) ? product.image[0] : product.image;

    return {
      externalId: `${storeName.toLowerCase()}-${index}-${product.sku || product.mpn || product.name}`,
      productName: product.name,
      imageUrl: absolutizeUrl(image, sourceUrl),
      storeName,
      category,
      currentPrice: offer?.price,
      originalPrice: null,
      discountPercent: null,
      couponCode: null,
      paymentDetails: null,
      installmentPrice: null,
      stockStatus: offer?.availability ? String(offer.availability).split('/').pop() : null,
      productUrl: absolutizeUrl(offer?.url || product.url, sourceUrl),
      dealEndsAt: offer?.priceValidUntil || null,
      brand: typeof product.brand === 'string' ? product.brand : product.brand?.name,
      model: product.model || null,
      specs: product.description,
      shippingInfo: null,
      rating: product.aggregateRating?.ratingValue ? `${product.aggregateRating.ratingValue}/5` : null,
      reviewCount: product.aggregateRating?.reviewCount || null,
      isFlashSale: /promo|oferta|flash|sale/i.test(html),
      description: product.description,
      source: `${storeName} experimental JSON-LD scrape`
    };
  });
}
