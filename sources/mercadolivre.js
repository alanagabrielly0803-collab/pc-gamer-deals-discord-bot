import axios from 'axios';
import * as cheerio from 'cheerio';

import { config } from '../config.js';
import { discountPercent } from '../utils/price.js';

const API_BASE_URL = 'https://api.mercadolibre.com/sites/MLB/search';
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

const BOOST_SEARCH_TERMS = [
  'ssd nvme',
  'ssd sata',
  'memoria ram ddr4',
  'memoria ram ddr5',
  'placa mae am4',
  'placa mae am5',
  'processador ryzen',
  'processador intel core',
  'placa de video rtx',
  'placa de video radeon',
  'fonte atx 80 plus',
  'gabinete gamer',
  'water cooler',
  'cooler processador',
  'monitor gamer 144hz',
  'monitor gamer 165hz',
  'teclado mecanico gamer',
  'mouse gamer',
  'mousepad gamer',
  'headset gamer',
  'microfone usb',
  'webcam full hd',
  'hub usb',
  'dock station',
  'placa de captura',
  'cabo hdmi',
  'cabo displayport',
  'adaptador usb c'
];

const SORTS = ['relevance', 'price_asc'];
const API_PAGES = [0, 50];
const HTML_PAGES = [0, 50];
const MAX_TERMS = 32;

function cleanText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function classifyCategory(title) {
  const value = String(title || '').toLowerCase();

  if (value.includes('ssd')) return 'Armazenamento SSD';
  if (value.includes('hd externo') || value.includes('hd interno')) return 'Armazenamento';
  if (value.includes('memoria') || value.includes('memória') || value.includes('ram')) return 'Memória RAM';
  if (value.includes('placa mae') || value.includes('placa mãe') || value.includes('motherboard')) return 'Placa-mãe';
  if (value.includes('processador') || value.includes('ryzen') || value.includes('intel')) return 'Processador';
  if (value.includes('placa de video') || value.includes('placa de vídeo') || value.includes('gpu') || value.includes('rtx') || value.includes('radeon')) return 'Placa de vídeo';
  if (value.includes('fonte')) return 'Fonte';
  if (value.includes('cooler') || value.includes('water cooler')) return 'Cooler';
  if (value.includes('monitor')) return 'Monitor';
  if (value.includes('teclado')) return 'Teclado gamer';
  if (value.includes('mousepad')) return 'Mousepad';
  if (value.includes('mouse')) return 'Mouse gamer';
  if (value.includes('headset') || value.includes('fone')) return 'Headset gamer';
  if (value.includes('microfone')) return 'Microfone';
  if (value.includes('webcam')) return 'Webcam';
  if (value.includes('hub usb') || value.includes('usb hub')) return 'Hub USB';
  if (value.includes('dock')) return 'Dock';
  if (value.includes('capture') || value.includes('captura')) return 'Placa de captura';
  if (value.includes('gabinete')) return 'Gabinete';

  return 'Hardware';
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
    .filter(Boolean)
    .filter((term) => !/impressora|toner|cartucho|notebook|roteador|nobreak|filtro de linha|repetidor|mesh|ps5|xbox|nintendo/i.test(term));

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

    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  return uniqueBy(allDeals, (deal) => `${deal.productUrl}|${deal.currentPrice}|${deal.productName}`);
}

async function fetchMercadoLivreSearchResults(keyword, sort) {
  const apiDeals = await fetchMercadoLivreApiDeals(keyword, sort);
  if (apiDeals.length > 0) {
    return apiDeals;
  }

  const htmlDeals = await fetchMercadoLivreHtmlDeals(keyword);
  if (htmlDeals.length > 0) {
    return htmlDeals;
  }

  return [];
}

async function fetchMercadoLivreApiDeals(keyword, sort) {
  const deals = [];

  for (const offset of API_PAGES) {
    try {
      const params = {
        q: keyword,
        limit: 50,
        offset
      };

      if (sort && sort !== 'relevance') {
        params.sort = sort;
      }

      const { data } = await axios.get(API_BASE_URL, {
        params,
        timeout: 20000,
        headers: {
          'User-Agent': USER_AGENT,
          Accept: 'application/json,text/plain,*/*'
        }
      });

      const results = Array.isArray(data?.results) ? data.results : [];
      deals.push(...results.map((item) => mapMercadoLivreApiItem(item)).filter(Boolean));
    } catch (error) {
      console.warn(`[mercadolivre] API failed for "${keyword}" offset=${offset}: ${error.response?.status || ''} ${error.message}`);
    }
  }

  return uniqueBy(deals, (deal) => deal.productUrl || deal.externalId);
}

async function fetchMercadoLivreHtmlDeals(keyword) {
  const searchSlug = buildMercadoLivreSearchSlug(keyword);
  const deals = [];

  for (const offset of HTML_PAGES) {
    const url =
      offset > 0
        ? `https://lista.mercadolivre.com.br/${searchSlug}_Desde_${offset}`
        : `https://lista.mercadolivre.com.br/${searchSlug}`;

    try {
      const { data: html } = await axios.get(url, {
        timeout: 20000,
        headers: {
          'User-Agent': USER_AGENT,
          Accept: 'text/html,application/xhtml+xml'
        }
      });

      const $ = cheerio.load(html);
      const links = $(
        'a[href*="/MLB-"], a[href*="/p/MLB"], a[href*="produto.mercadolivre.com.br"], a.ui-search-link'
      ).toArray();

      for (const [index, linkEl] of links.entries()) {
        const linkEl$ = $(linkEl);
        const productUrl = absoluteUrl('https://www.mercadolivre.com.br', linkEl$.attr('href') || null);
        if (!productUrl) continue;

        const card = linkEl$.closest('li, article, div.ui-search-result, div.ui-search-layout__item, div[class*="poly-card"], div');
        const title =
          cleanText(card.find('h2, .ui-search-item__title, [class*="title"], [class*="poly-component__title"]').first().text()) ||
          cleanText(linkEl$.attr('title')) ||
          cleanText(linkEl$.find('img[alt]').first().attr('alt')) ||
          cleanText(linkEl$.text());

        if (!title || title.length < 5) continue;

        const currentPrice = parseHtmlPrice(card);
        const originalPrice = parseHtmlOriginalPrice(card);
        const discount = originalPrice ? discountPercent(originalPrice, currentPrice) : null;
        const imageUrl = getHtmlImageUrl(card);

        if (!currentPrice) continue;

        deals.push({
          externalId: `mlb-html-${searchSlug}-${offset}-${index}`,
          productName: title,
          imageUrl,
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
          shippingInfo: /frete gr[aá]tis/i.test(card.text()) ? 'Frete grátis' : null,
          rating: null,
          reviewCount: null,
          isFlashSale: Boolean(originalPrice && currentPrice && originalPrice > currentPrice),
          description: `${title} encontrado no Mercado Livre.`,
          source: 'Mercado Livre HTML search fallback'
        });
      }
    } catch (error) {
      console.warn(`[mercadolivre] HTML failed for "${keyword}" offset=${offset}: ${error.response?.status || ''} ${error.message}`);
    }
  }

  return uniqueBy(deals, (deal) => deal.productUrl || deal.externalId);
}

function mapMercadoLivreApiItem(item) {
  if (!item?.id || !item?.title || !item?.price || !item?.permalink) return null;

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
    installmentPrice: item.installments ? `${item.installments.quantity}x de R$ ${item.installments.amount}` : null,
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

function getHtmlImageUrl(card) {
  const image = card.find('img').first();
  const candidates = [
    image.attr('src'),
    image.attr('data-src'),
    image.attr('data-lazy-src'),
    String(image.attr('srcset') || '').split(',').map((part) => part.trim().split(/\s+/)[0]).find(Boolean)
  ].filter(Boolean);

  const value = candidates.find(Boolean);
  return value ? value.replace('http://', 'https://') : null;
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
