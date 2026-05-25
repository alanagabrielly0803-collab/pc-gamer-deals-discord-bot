import axios from 'axios';
import * as cheerio from 'cheerio';

import { config } from '../config.js';
import { discountPercent } from '../utils/price.js';

const API_BASE_URL = 'https://api.mercadolibre.com/sites/MLB/search';
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

const BOOST_SEARCH_TERMS = [
  'pc gamer',
  'pc completo',
  'pc montado',
  'setup gamer',
  'kit gamer',
  'gabinete gamer',
  'notebook gamer',
  'teclado mecanico',
  'teclado gamer',
  'mouse sem fio',
  'mouse gamer',
  'headset sem fio',
  'headset gamer',
  'monitor ultrawide',
  'monitor 144hz',
  'monitor 165hz',
  'ssd nvme',
  'ssd 1tb',
  'ssd 2tb',
  'placa de video rtx',
  'placa de video rx',
  'placa de video',
  'ryzen 7',
  'ryzen 5',
  'intel core i5',
  'intel core i7',
  'fonte modular',
  'water cooler',
  'controle xbox',
  'controle playstation',
  'microfone usb',
  'webcam',
  'cooler',
  'memoria ram',
  'ram ddr4',
  'ram ddr5',
  'ssd',
  'monitor',
  'processador',
  'hardware',
  'gamer'
];

const SORTS = ['relevance', 'price_asc'];
const API_PAGES = [0, 50];
const HTML_PAGES = [0, 50];
const MAX_TERMS = 40;

function cleanText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function classifyCategory(title) {
  const value = String(title || '').toLowerCase();

  if (value.includes('teclado')) return 'Gaming Keyboard';
  if (value.includes('mousepad')) return 'Mousepad';
  if (value.includes('mouse')) return 'Gaming Mouse';
  if (value.includes('headset') || value.includes('fone')) return 'Gaming Headset';
  if (value.includes('monitor')) return 'Monitor';
  if (value.includes('ssd')) return 'SSD';
  if (value.includes('memória') || value.includes('memoria') || value.includes('ram')) return 'RAM';
  if (
    value.includes('placa de vídeo') ||
    value.includes('placa de video') ||
    value.includes('rtx') ||
    value.includes('radeon')
  ) {
    return 'Graphics Card';
  }
  if (value.includes('processador') || value.includes('ryzen') || value.includes('intel')) return 'Processor';
  if (value.includes('placa mãe') || value.includes('placa mae') || value.includes('motherboard')) return 'Motherboard';
  if (value.includes('fonte')) return 'Power Supply';
  if (value.includes('cooler') || value.includes('water cooler')) return 'CPU Cooler';
  if (value.includes('cadeira')) return 'Gaming Chair';
  if (value.includes('controle')) return 'Controller';
  if (value.includes('notebook') || value.includes('laptop')) return 'Laptop';
  if (value.includes('gabinete')) return 'PC Case';

  return 'PC Gamer Accessory';
}

function buildMercadoLivreSearchSlug(keyword) {
  return String(keyword || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function uniqueBy(items, selector) {
  const seen = new Set();
  return items.filter((item) => {
    const key = selector(item);
    if (!key || seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function resolveSearchTerms() {
  const terms = [
    ...(Array.isArray(config.includeKeywords) ? config.includeKeywords : []),
    ...BOOST_SEARCH_TERMS
  ]
    .map((term) => String(term).trim().toLowerCase())
    .filter(Boolean);

  return uniqueBy(terms, (term) => term).slice(0, MAX_TERMS);
}

export async function fetchMercadoLivreDeals() {
  const searchTerms = resolveSearchTerms();
  const allDeals = [];

  for (let index = 0; index < searchTerms.length; index += 1) {
    const keyword = searchTerms[index];
    const sort = SORTS[index % SORTS.length];
    const deals = await fetchMercadoLivreSearchResults(keyword, sort);
    allDeals.push(...deals);

    await new Promise((resolve) => setTimeout(resolve, 350));
  }

  return uniqueBy(allDeals, (deal) => `${deal.productUrl}|${deal.currentPrice}|${deal.productName}`);
}

async function fetchMercadoLivreSearchResults(keyword, sort) {
  try {
    const apiDeals = await fetchMercadoLivreApiDeals(keyword, sort);
    if (apiDeals.length > 0) {
      return apiDeals;
    }
  } catch {
    // Fallback below.
  }

  try {
    const htmlDeals = await fetchMercadoLivreHtmlDeals(keyword);
    if (htmlDeals.length > 0) {
      return htmlDeals;
    }
  } catch {
    // Ignore and return empty.
  }

  return [];
}

async function fetchMercadoLivreApiDeals(keyword, sort) {
  const deals = [];

  for (const offset of API_PAGES) {
    const { data } = await axios.get(API_BASE_URL, {
      params: {
        q: keyword,
        limit: 50,
        offset,
        sort
      },
      timeout: 20000,
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'application/json,text/plain,*/*'
      }
    });

    const results = Array.isArray(data?.results) ? data.results : [];
    deals.push(...results.map((item) => mapMercadoLivreApiItem(item)));
  }

  return uniqueBy(deals, (deal) => deal.productUrl || deal.externalId);
}

async function fetchMercadoLivreHtmlDeals(keyword) {
  const searchSlug = buildMercadoLivreSearchSlug(keyword);
  const deals = [];

  for (const offset of HTML_PAGES) {
    const url = offset > 0
      ? `https://lista.mercadolivre.com.br/${searchSlug}_Desde_${offset}`
      : `https://lista.mercadolivre.com.br/${searchSlug}`;

    const { data: html } = await axios.get(url, {
      timeout: 20000,
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml'
      }
    });

    const $ = cheerio.load(html);
    const cards = $('li.ui-search-layout__item, div.ui-search-layout__item, article.ui-search-layout__item');

    cards.each((_, cardEl) => {
      const card = $(cardEl);
      const linkEl = card
        .find('a.ui-search-item__group__element, a.ui-search-link, a[href*="/MLB-"]')
        .first();

      const productUrl = absoluteUrl('https://www.mercadolivre.com.br', linkEl.attr('href') || null);
      const title =
        cleanText(card.find('h2.ui-search-item__title').first().text()) ||
        cleanText(card.find('.ui-search-item__title').first().text()) ||
        cleanText(linkEl.text());

      if (!productUrl || !title) {
        return;
      }

      const currentPrice = parseHtmlPrice(card);
      const originalPrice = parseHtmlOriginalPrice(card);
      const discount = originalPrice ? discountPercent(originalPrice, currentPrice) : null;
      const imageUrl =
        card.find('img.ui-search-result-image__element').first().attr('src') ||
        card.find('img').first().attr('src') ||
        null;

      deals.push({
        externalId: `mlb-html-${searchSlug}-${offset}-${deals.length}`,
        productName: title,
        imageUrl: imageUrl ? imageUrl.replace('http://', 'https://') : null,
        storeName: 'Mercado Livre',
        category: classifyCategory(title),
        currentPrice,
        originalPrice,
        discountPercent: discount,
        couponCode: null,
        paymentDetails: card.text().toLowerCase().includes('mercado pago') ? 'Mercado Pago' : null,
        installmentPrice: null,
        stockStatus: null,
        productUrl,
        dealEndsAt: null,
        brand: null,
        model: null,
        specs: null,
        shippingInfo: card.text().toLowerCase().includes('frete grátis') ? 'Frete grátis' : null,
        rating: null,
        reviewCount: null,
        isFlashSale: Boolean(originalPrice && currentPrice && originalPrice > currentPrice),
        description: `${title} encontrado no Mercado Livre.`,
        source: 'Mercado Livre HTML search fallback'
      });
    });
  }

  return uniqueBy(deals, (deal) => deal.productUrl || deal.externalId);
}

function mapMercadoLivreApiItem(item) {
  const originalPrice = item.original_price || null;
  const discount = originalPrice ? discountPercent(originalPrice, item.price) : null;

  return {
    externalId: `mlb-${item.id}`,
    productName: item.title,
    imageUrl: item.thumbnail?.replace('http://', 'https://'),
    storeName: 'Mercado Livre',
    category: classifyCategory(item.title),
    currentPrice: item.price,
    originalPrice,
    discountPercent: discount,
    couponCode: null,
    paymentDetails: item.accepts_mercadopago ? 'Mercado Pago' : null,
    installmentPrice: item.installments
      ? `${item.installments.quantity}x de R$ ${item.installments.amount}`
      : null,
    stockStatus: item.available_quantity > 0 ? 'Available' : null,
    productUrl: item.permalink,
    dealEndsAt: null,
    brand: item.attributes?.find((attr) => attr.id === 'BRAND')?.value_name || null,
    model: item.attributes?.find((attr) => attr.id === 'MODEL')?.value_name || null,
    specs: null,
    shippingInfo: item.shipping?.free_shipping ? 'Frete grátis' : null,
    rating: null,
    reviewCount: null,
    isFlashSale: Boolean(item.sale_price),
    description: `${item.title} encontrado no Mercado Livre.`,
    source: 'Mercado Livre public search API'
  };
}

function absoluteUrl(baseUrl, href) {
  if (!href) return null;
  try {
    return new URL(href, baseUrl).toString();
  } catch {
    return href;
  }
}

function parseHtmlPrice(card) {
  const candidates = [
    card.find('.andes-money-amount--cents-superscript, .andes-money-amount__fraction').first().text(),
    card.find('.andes-money-amount__fraction').first().text(),
    card.find('[class*="price"] .andes-money-amount__fraction').first().text(),
    card.text()
  ];

  for (const candidate of candidates) {
    const match = String(candidate).match(/R\$\s*([\d\.]+(?:,\d{2})?)/i);
    if (match) {
      return `R$ ${match[1]}`;
    }
  }

  return null;
}

function parseHtmlOriginalPrice(card) {
  const selectors = [
    '.andes-money-amount--previous .andes-money-amount__fraction',
    '.price-tag .price-tag-amount',
    '[class*="previous"]',
    '[class*="strikethrough"]'
  ];

  for (const selector of selectors) {
    const text = cleanText(card.find(selector).first().text());
    const match = text.match(/R\$\s*([\d\.]+(?:,\d{2})?)/i);
    if (match) {
      return `R$ ${match[1]}`;
    }
  }

  return null;
}
