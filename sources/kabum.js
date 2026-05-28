import axios from 'axios';
import * as cheerio from 'cheerio';

import { cleanText } from '../utils/text.js';
import { discountPercent, parsePrice } from '../utils/price.js';
import { normalizeImageUrl } from '../utils/url.js';

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

const PROMOTION_PAGES = [
  'https://www.kabum.com.br/promocao/GAMER',
  'https://www.kabum.com.br/promocao/TECLADOGAMER',
  'https://www.kabum.com.br/promocao/MOUSEGAMER',
  'https://www.kabum.com.br/promocao/MONITORBARATO',
  'https://www.kabum.com.br/promocao/COMPUTADORKABUM',
  'https://www.kabum.com.br/promocao/PERIFERICOSEESPACOGAMER',
  'https://www.kabum.com.br/promocao/CCHEADSETETECLADOGAMER',
  'https://www.kabum.com.br/promocao/CCESPACOGAMER'
];

function uniqueBy(items, selector) {
  const seen = new Set();
  return items.filter((item) => {
    const key = selector(item);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function absoluteUrl(baseUrl, href) {
  if (!href) return null;

  try {
    return new URL(href, baseUrl).toString();
  } catch {
    return null;
  }
}

function classifyCategory(title) {
  const value = String(title || '').toLowerCase();

  if (value.includes('teclado')) return 'Teclado gamer';
  if (value.includes('mouse')) return 'Mouse gamer';
  if (value.includes('headset') || value.includes('fone')) return 'Headset gamer';
  if (value.includes('monitor')) return 'Monitor';
  if (value.includes('ssd')) return 'Armazenamento SSD';
  if (value.includes('memoria') || value.includes('ram')) return 'Memória RAM';
  if (value.includes('placa de video') || value.includes('gpu') || value.includes('rtx') || value.includes('radeon')) {
    return 'Placa de vídeo';
  }
  if (value.includes('processador') || value.includes('cpu') || value.includes('ryzen') || value.includes('intel')) {
    return 'Processador';
  }
  if (value.includes('gabinete')) return 'Gabinete';
  if (value.includes('cadeira') || value.includes('mesa')) return 'Espaço Gamer';
  if (value.includes('microfone')) return 'Microfone';
  if (value.includes('webcam')) return 'Webcam';
  if (value.includes('hub') || value.includes('dock')) return 'Acessórios';

  return 'Hardware';
}

function extractPriceMatches(text) {
  return [...String(text || '').matchAll(/R\$\s*([\d\.]+(?:,\d{2})?)/g)].map((match) => `R$ ${match[1]}`);
}

function getCurrentAndOriginalPrice(text) {
  const prices = extractPriceMatches(text);
  if (prices.length === 0) {
    return { currentPrice: null, originalPrice: null };
  }

  if (prices.length === 1) {
    return { currentPrice: prices[0], originalPrice: null };
  }

  const hasDiscountLanguage = /desconto|de\s+r\$|por\s+r\$|pix/i.test(text);
  if (!hasDiscountLanguage) {
    return { currentPrice: prices[prices.length - 1], originalPrice: prices[0] };
  }

  return { currentPrice: prices[prices.length - 1], originalPrice: prices[0] };
}

function parseJsonLdProducts($, sourceUrl) {
  const products = [];

  const scriptSets = [
    $('script#productSchema'),
    $('script[type="application/ld+json"]')
  ];

  for (const scriptSet of scriptSets) {
    scriptSet.each((_index, el) => {
      const raw = $(el).contents().text();

      try {
        const parsed = JSON.parse(raw);
        const nodes = Array.isArray(parsed) ? parsed : [parsed];

        for (const node of nodes) {
          collectProductNodes(node, products);
        }
      } catch {
        // Ignore invalid JSON-LD blocks.
      }
    });
  }

  return products
    .map((product, index) => mapJsonLdProduct(product, sourceUrl, index))
    .filter(Boolean);
}

function parseCatalogProducts($, sourceUrl) {
  const raw = $('#__NEXT_DATA__').text();
  if (!raw) return [];

  try {
    const nextData = JSON.parse(raw);
    const catalogData = nextData?.props?.pageProps?.data?.catalogServer?.data;
    const items = Array.isArray(catalogData)
      ? catalogData
      : catalogData && typeof catalogData === 'object'
        ? [catalogData]
        : [];

    return items
      .map((item, index) => mapCatalogProduct(item, sourceUrl, index))
      .filter(Boolean);
  } catch {
    return [];
  }
}

function collectProductNodes(node, products) {
  if (!node || typeof node !== 'object') return;

  const type = node['@type'];
  if (type === 'Product' || (Array.isArray(type) && type.includes('Product'))) {
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

function mapJsonLdProduct(product, sourceUrl, index) {
  const offer = product.offer || (Array.isArray(product.offers) ? product.offers[0] : product.offers || null);
  const image = Array.isArray(product.image) ? product.image[0] : product.image;
  const saleOffer = offer?.offer || offer || null;
  const current = parsePrice(
    saleOffer?.priceWithDiscount ??
      saleOffer?.salePrice ??
      saleOffer?.price ??
      product.priceWithDiscount ??
      product.salePrice ??
      product.price
  );
  const original = parsePrice(
    saleOffer?.price ??
      saleOffer?.oldPrice ??
      product.oldPrice ??
      product.price ??
      saleOffer?.priceMarketplace
  );
  const discount =
    Number.isFinite(Number(saleOffer?.discountPercentage)) && Number(saleOffer.discountPercentage) > 0
      ? Number(saleOffer.discountPercentage)
      : discountPercent(original, current);

  if (!product?.name || current === null) {
    return null;
  }

  return {
    externalId: `kabum-jsonld-${index}-${product.sku || product.mpn || product.name}`,
    productName: cleanText(product.name, 180),
    imageUrl: normalizeImageUrl(absoluteUrl(sourceUrl, image)),
    storeName: 'Kabum',
    category: classifyCategory(product.name),
    currentPrice: current,
    originalPrice: original,
    discountPercent: discount,
    couponCode: null,
    paymentDetails: null,
    installmentPrice: null,
    stockStatus: saleOffer?.availability ? String(saleOffer.availability).split('/').pop() : null,
    productUrl: absoluteUrl(sourceUrl, saleOffer?.url || product.url),
    dealEndsAt: saleOffer?.priceValidUntil || null,
    brand: typeof product.brand === 'string' ? product.brand : product.brand?.name || null,
    model: product.model || null,
    specs: cleanText(product.description, 500),
    shippingInfo: null,
    rating: product.aggregateRating?.ratingValue ? `${product.aggregateRating.ratingValue}/5` : null,
    reviewCount: product.aggregateRating?.reviewCount || null,
    isFlashSale: /promo|oferta|flash|sale|desconto/i.test(`${product.name} ${product.description || ''}`),
    description: cleanText(product.description || `${product.name} encontrado na KaBuM!`, 700),
    source: 'KaBuM JSON-LD promo scrape'
  };
}

function mapCatalogProduct(product, sourceUrl, index) {
  if (!product?.name) return null;

  const saleOffer = product.offer || (Array.isArray(product.offers) ? product.offers[0] : product.offers || null);
  const current = parsePrice(
    saleOffer?.priceWithDiscount ??
      product.priceWithDiscount ??
      saleOffer?.price ??
      product.price
  );
  const original = parsePrice(
    saleOffer?.price ??
      product.oldPrice ??
      product.price
  );
  const discount =
    Number.isFinite(Number(saleOffer?.discountPercentage)) && Number(saleOffer.discountPercentage) > 0
      ? Number(saleOffer.discountPercentage)
      : Number.isFinite(Number(product.discountPercentage)) && Number(product.discountPercentage) > 0
        ? Number(product.discountPercentage)
        : discountPercent(original, current);

  if (current === null) return null;

  const productUrl =
    absoluteUrl(sourceUrl, saleOffer?.url) ||
    absoluteUrl(sourceUrl, product.externalUrl) ||
    absoluteUrl(sourceUrl, `/produto/${product.code}/${product.friendlyName || ''}`);

  return {
    externalId: `kabum-catalog-${index}-${product.code || product.friendlyName || product.name}`,
    productName: cleanText(product.name, 180),
    imageUrl: normalizeImageUrl(product.image || product.thumbnail || product.images?.[0] || null),
    storeName: 'Kabum',
    category: classifyCategory(product.name),
    currentPrice: current,
    originalPrice: original,
    discountPercent: discount,
    couponCode: product.stamps?.title || null,
    paymentDetails: product.flags?.isPixShipping ? 'Pix' : null,
    installmentPrice: product.maxInstallment || null,
    stockStatus: product.available ? 'Available' : 'Unavailable',
    productUrl,
    dealEndsAt: saleOffer?.endsAt ? new Date(Number(saleOffer.endsAt) * 1000).toISOString() : null,
    brand: product.manufacturer?.name || null,
    model: product.model || null,
    specs: cleanText(product.description, 500),
    shippingInfo: product.flags?.isFreeShipping ? 'Frete grátis' : null,
    rating: product.rating ? String(product.rating) : null,
    reviewCount: product.ratingCount || null,
    isFlashSale:
      Boolean(product.flags?.isFlash || product.flags?.isOffer || product.flags?.isHighlight) ||
      /promo|oferta|flash|sale|desconto|cupom|esquenta/i.test(`${product.name} ${product.description || ''}`),
    description: cleanText(product.tagDescription || product.description || `${product.name} encontrado na KaBuM!`, 700),
    source: 'KaBuM catalog promo scrape'
  };
}

function parsePromoCard($, el, sourceUrl, index) {
  const card = $(el);
  const link = card.find('a[href*="/produto/"]').first();
  const href = link.attr('href');
  const productUrl = absoluteUrl(sourceUrl, href);

  if (!productUrl) return null;

  const productName =
    cleanText(link.attr('aria-label') || link.attr('title'), 180) ||
    cleanText(card.find('h2, h3, h4').first().text(), 180) ||
    cleanText(link.text(), 180);

  if (!productName) return null;

  const text = cleanText(card.text(), 1200);
  const { currentPrice, originalPrice } = getCurrentAndOriginalPrice(text);
  const current = parsePrice(currentPrice);
  const original = parsePrice(originalPrice);
  const discount = discountPercent(original, current);
  const image =
    normalizeImageUrl(card.find('img').first().attr('src')) ||
    normalizeImageUrl(card.find('img').first().attr('data-src')) ||
    null;

  if (current === null) return null;

  return {
    externalId: `kabum-html-${index}-${href}`,
    productName,
    imageUrl: image,
    storeName: 'Kabum',
    category: classifyCategory(productName),
    currentPrice: current,
    originalPrice: original,
    discountPercent: discount,
    couponCode: /cupom/i.test(text) ? 'Cupom' : null,
    paymentDetails: /pix/i.test(text) ? 'Pix' : null,
    installmentPrice: text.match(/em até\s+\d+x\s+de\s+R\$\s*[\d\.,]+/i)?.[0] || null,
    stockStatus: /unid\./i.test(text) ? 'Available' : null,
    productUrl,
    dealEndsAt: null,
    brand: null,
    model: null,
    specs: null,
    shippingInfo: /frete grátis/i.test(text) ? 'Frete grátis' : null,
    rating: null,
    reviewCount: null,
    isFlashSale: /promo|oferta|flash|sale|desconto|cupom|esquenta/i.test(text),
    description: `${productName} encontrado na KaBuM!`,
    source: 'KaBuM promo page scrape'
  };
}

async function fetchKabumPage(url) {
  const { data: html } = await axios.get(url, {
    timeout: 20000,
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml'
    }
  });

  const $ = cheerio.load(html);
  const catalogDeals = parseCatalogProducts($, url);
  if (catalogDeals.length > 0) {
    return catalogDeals;
  }

  const jsonLdDeals = parseJsonLdProducts($, url);
  if (jsonLdDeals.length > 0) {
    return jsonLdDeals;
  }

  const cards = $('article, li, div')
    .filter((_index, el) => String($(el).html() || '').includes('/produto/'))
    .toArray();

  const deals = [];

  for (const [index, el] of cards.entries()) {
    const deal = parsePromoCard($, el, url, index);
    if (deal) {
      deals.push(deal);
    }
  }

  return deals;
}

export async function fetchKabumDeals() {
  const deals = [];

  for (const url of PROMOTION_PAGES) {
    try {
      const pageDeals = await fetchKabumPage(url);
      deals.push(...pageDeals);
    } catch {
      // Ignore page-level failures and keep moving through the promo catalog.
    }
  }

  return uniqueBy(deals, (deal) => `${deal.productUrl}|${deal.currentPrice}|${deal.productName}`);
}
