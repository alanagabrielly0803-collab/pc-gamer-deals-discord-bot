import axios from 'axios';
import * as cheerio from 'cheerio';

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

const SOURCE_PAGES = [
  'https://www.terabyteshop.com.br/promocoes',
  'https://www.terabyteshop.com.br/hardware',
  'https://www.terabyteshop.com.br/ofertas/ssd',
  'https://www.terabyteshop.com.br/ofertas/processadores',
  'https://www.terabyteshop.com.br/ofertas/fontes',
  'https://www.terabyteshop.com.br/ofertas/memoria-ram',
  'https://www.terabyteshop.com.br/ofertas/placa-de-video',
  'https://www.terabyteshop.com.br/ofertas/monitor',
  'https://www.terabyteshop.com.br/ofertas/teclados',
  'https://www.terabyteshop.com.br/ofertas/mouses',
  'https://www.terabyteshop.com.br/ofertas/notebooks',
  'https://www.terabyteshop.com.br/ofertas/rede-e-internet'
];

function cleanText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

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

function parseJsonLdProducts($, sourceUrl) {
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
      // Ignore invalid JSON-LD blocks.
    }
  });

  return products
    .map((product, index) => mapJsonLdProduct(product, sourceUrl, index))
    .filter(Boolean);
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
  const offer = Array.isArray(product.offers) ? product.offers[0] : product.offers;
  const image = Array.isArray(product.image) ? product.image[0] : product.image;
  const price = offer?.price ?? offer?.lowPrice ?? null;

  if (!product?.name || !price) {
    return null;
  }

  return {
    externalId: `terabyte-jsonld-${index}-${product.sku || product.mpn || product.name}`,
    productName: cleanText(product.name),
    imageUrl: absoluteUrl(sourceUrl, image),
    storeName: 'Terabyte',
    category: inferCategory(product.name, product.description),
    currentPrice: price,
    originalPrice: null,
    discountPercent: null,
    couponCode: null,
    paymentDetails: null,
    installmentPrice: null,
    stockStatus: offer?.availability ? String(offer.availability).split('/').pop() : null,
    productUrl: absoluteUrl(sourceUrl, offer?.url || product.url),
    dealEndsAt: offer?.priceValidUntil || null,
    brand: typeof product.brand === 'string' ? product.brand : product.brand?.name || null,
    model: product.model || null,
    specs: product.description || null,
    shippingInfo: null,
    rating: product.aggregateRating?.ratingValue ? `${product.aggregateRating.ratingValue}/5` : null,
    reviewCount: product.aggregateRating?.reviewCount || null,
    isFlashSale: /promo|oferta|flash|sale/i.test(`${product.name} ${product.description || ''}`),
    description: cleanText(product.description || `${product.name} encontrado na Terabyte.`),
    source: 'Terabyte JSON-LD scrape'
  };
}

function inferCategory(name, description = '') {
  const value = `${name} ${description}`.toLowerCase();

  if (value.includes('ssd')) return 'Armazenamento SSD';
  if (value.includes('memoria') || value.includes('ram')) return 'Memória RAM';
  if (value.includes('placa de video') || value.includes('rtx') || value.includes('radeon')) return 'Placa de vídeo';
  if (value.includes('processador') || value.includes('ryzen') || value.includes('intel')) return 'Processador';
  if (value.includes('fonte')) return 'Fonte';
  if (value.includes('gabinete')) return 'Gabinete';
  if (value.includes('cooler') || value.includes('water cooler')) return 'Cooler';
  if (value.includes('monitor')) return 'Monitor';
  if (value.includes('teclado')) return 'Teclado gamer';
  if (value.includes('mouse')) return 'Mouse gamer';
  if (value.includes('headset') || value.includes('fone')) return 'Headset gamer';
  if (value.includes('microfone')) return 'Microfone';
  if (value.includes('webcam')) return 'Webcam';
  if (value.includes('hub usb') || value.includes('usb hub')) return 'Hub USB';
  if (value.includes('roteador') || value.includes('switch') || value.includes('wifi')) return 'Rede';
  if (value.includes('notebook') || value.includes('laptop')) return 'Notebook';
  if (value.includes('impressora') || value.includes('toner') || value.includes('cartucho')) return 'Impressora';
  if (value.includes('dock')) return 'Dock';
  if (value.includes('capture')) return 'Placa de captura';

  return 'Hardware';
}

function parseCurrency(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;

  const text = String(value);
  const match = text.match(/R\$\s*([\d\.]+(?:,\d{2})?)/i) || text.match(/([\d\.]+,\d{2})/);
  if (!match) return null;

  return Number(match[1].replace(/\./g, '').replace(',', '.'));
}

function parsePercent(value) {
  if (!value && value !== 0) return null;
  const text = String(value).replace('%', '').trim();
  const number = Number(text.replace(',', '.'));
  return Number.isFinite(number) ? number : null;
}

function parsePriceBlock(card) {
  const text = cleanText(card.text());
  const allPrices = [...text.matchAll(/R\$\s*([\d\.]+(?:,\d{2})?)/gi)].map((match) => match[1]);

  if (allPrices.length === 0) return { currentPrice: null, originalPrice: null };

  const currentPrice = `R$ ${allPrices[allPrices.length - 1]}`;
  const originalPrice = allPrices.length > 1 ? `R$ ${allPrices[0]}` : null;

  return { currentPrice, originalPrice };
}

function parseFallbackCards($, sourceUrl) {
  const deals = [];
  const cards = $('article, li, div').filter((_, el) => {
    const text = cleanText($(el).text());
    return /R\$\s*[\d\.]+(?:,\d{2})?/i.test(text) && /\/produto\//i.test(text);
  });

  cards.each((index, el) => {
    const card = $(el);
    const link = card.find('a[href*="/produto/"]').first();
    const productUrl = absoluteUrl(sourceUrl, link.attr('href'));
    const productName =
      cleanText(link.attr('title')) ||
      cleanText(link.text()) ||
      cleanText(card.find('h1, h2, h3, h4').first().text());

    if (!productUrl || !productName) return;

    const { currentPrice, originalPrice } = parsePriceBlock(card);
    if (!currentPrice) return;

    const image =
      absoluteUrl(sourceUrl, card.find('img').first().attr('src')) ||
      absoluteUrl(sourceUrl, card.find('img').first().attr('data-src')) ||
      null;

    const discountPercent = parsePercent(card.text().match(/(\d{1,2})%/i)?.[1]);

    deals.push({
      externalId: `terabyte-fallback-${index}-${productUrl}`,
      productName,
      imageUrl: image,
      storeName: 'Terabyte',
      category: inferCategory(productName, card.text()),
      currentPrice,
      originalPrice,
      discountPercent,
      couponCode: null,
      paymentDetails: card.text().includes('pix') ? 'Pix' : null,
      installmentPrice: null,
      stockStatus: /frete gratis/i.test(textOf(card)) ? 'Available' : null,
      productUrl,
      dealEndsAt: null,
      brand: null,
      model: null,
      specs: null,
      shippingInfo: /frete gratis/i.test(textOf(card)) ? 'Frete grátis' : null,
      rating: null,
      reviewCount: null,
      isFlashSale: /promo|oferta|flash|sale/i.test(card.text()),
      description: `${productName} encontrado na Terabyte.`,
      source: 'Terabyte public promo scrape'
    });
  });

  return deals;
}

function textOf(card) {
  return cleanText(card.text());
}

export async function fetchTerabyteDeals() {
  const deals = [];

  for (const url of SOURCE_PAGES) {
    try {
      const { data: html } = await axios.get(url, {
        timeout: 20000,
        headers: {
          'User-Agent': USER_AGENT,
          Accept: 'text/html,application/xhtml+xml'
        }
      });

      const $ = cheerio.load(html);
      const jsonLdDeals = parseJsonLdProducts($, url);
      if (jsonLdDeals.length > 0) {
        deals.push(...jsonLdDeals);
        continue;
      }

      deals.push(...parseFallbackCards($, url));
    } catch {
      // Ignore page-level failures and keep moving through the catalog.
    }
  }

  return uniqueBy(deals, (deal) => `${deal.productUrl}|${deal.currentPrice}|${deal.productName}`);
}
