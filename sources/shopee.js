import axios from 'axios';
import * as cheerio from 'cheerio';

import { config } from '../config.js';
import { discountPercent } from '../utils/price.js';

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

const SHOPEE_ORIGIN = 'https://shopee.com.br';
const MAX_TERMS = 18;
const SEARCH_PAGES = [0, 1];

const BOOST_SEARCH_TERMS = [
  'ssd nvme',
  'ssd sata',
  'memoria ram ddr4',
  'memoria ram ddr5',
  'placa mae am4',
  'placa mae am5',
  'processador ryzen',
  'placa de video rtx',
  'placa de video radeon',
  'fonte atx 80 plus',
  'gabinete gamer',
  'water cooler',
  'monitor gamer 144hz',
  'teclado mecanico gamer',
  'mouse gamer',
  'headset gamer',
  'microfone usb',
  'webcam full hd'
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

function resolveSearchTerms() {
  const terms = [
    ...(Array.isArray(config.includeKeywords) ? config.includeKeywords : []),
    ...BOOST_SEARCH_TERMS
  ]
    .map((term) => String(term).trim().toLowerCase())
    .filter(Boolean)
    .filter((term) => !/impressora|toner|cartucho|notebook|roteador|nobreak|filtro de linha|repetidor|mesh|ps5|xbox|nintendo|cadeira|mesa gamer/i.test(term));

  return uniqueBy(terms, (term) => term).slice(0, MAX_TERMS);
}

function classifyCategory(title) {
  const value = String(title || '').toLowerCase();

  if (value.includes('ssd')) return 'Armazenamento SSD';
  if (value.includes('memoria') || value.includes('memória') || value.includes('ram')) return 'Memória RAM';
  if (value.includes('placa mae') || value.includes('placa mãe') || value.includes('motherboard')) return 'Placa-mãe';
  if (value.includes('processador') || value.includes('ryzen') || value.includes('intel')) return 'Processador';
  if (value.includes('placa de video') || value.includes('placa de vídeo') || value.includes('rtx') || value.includes('radeon')) return 'Placa de vídeo';
  if (value.includes('fonte')) return 'Fonte';
  if (value.includes('gabinete')) return 'Gabinete';
  if (value.includes('cooler') || value.includes('water cooler')) return 'Cooler';
  if (value.includes('monitor')) return 'Monitor';
  if (value.includes('teclado')) return 'Teclado gamer';
  if (value.includes('mousepad')) return 'Mousepad';
  if (value.includes('mouse')) return 'Mouse gamer';
  if (value.includes('headset') || value.includes('fone')) return 'Headset gamer';
  if (value.includes('microfone')) return 'Microfone';
  if (value.includes('webcam')) return 'Webcam';

  return 'Hardware';
}

function buildSearchUrl(keyword, page) {
  const params = new URLSearchParams({ keyword });
  if (page > 0) params.set('page', String(page));
  return `${SHOPEE_ORIGIN}/search?${params.toString()}`;
}

function absoluteUrl(baseUrl, href) {
  if (!href) return null;
  try {
    return new URL(href, baseUrl).toString();
  } catch {
    return null;
  }
}

function cleanShopeeUrl(url) {
  if (!url) return null;

  try {
    const parsed = new URL(url);
    parsed.hash = '';

    for (const key of [...parsed.searchParams.keys()]) {
      if (/utm_|sp_atk|xptdk|source|search|uls_trackid/i.test(key)) {
        parsed.searchParams.delete(key);
      }
    }

    return parsed.toString();
  } catch {
    return url;
  }
}

function normalizeImageUrl(value) {
  if (!value) return null;
  const url = String(value).replace(/^\/\//, 'https://').replace('http://', 'https://');
  if (!/^https:\/\//i.test(url)) return null;
  if (/logo|banner|placeholder|sprite|icon/i.test(url)) return null;
  return url;
}

function parsePrice(value) {
  if (value === null || value === undefined) return null;

  if (typeof value === 'number' && Number.isFinite(value)) {
    const price = value > 100000 ? value / 100000 : value;
    return `R$ ${price.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  const text = String(value);
  const match = text.match(/R\$\s*([\d\.]+(?:,\d{2})?)/i) || text.match(/([\d\.]+,\d{2})/);
  if (!match) return null;
  return `R$ ${match[1]}`;
}

function getPriceNumber(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value > 100000 ? value / 100000 : value;

  const text = String(value);
  const match = text.match(/R\$\s*([\d\.]+(?:,\d{2})?)/i) || text.match(/([\d\.]+,\d{2})/);
  if (!match) return null;

  const number = Number(match[1].replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(number) ? number : null;
}

function mapApiItem(item, keyword, index) {
  const basic = item?.item_basic || item;
  if (!basic) return null;

  const name = cleanText(basic.name || basic.title);
  const price = parsePrice(basic.price_min ?? basic.price ?? basic.price_before_discount);
  if (!name || !price) return null;

  const shopId = basic.shopid || basic.shop_id;
  const itemId = basic.itemid || basic.item_id;
  const productUrl = cleanShopeeUrl(
    basic.url
      ? absoluteUrl(SHOPEE_ORIGIN, basic.url)
      : shopId && itemId
        ? `${SHOPEE_ORIGIN}/${encodeURIComponent(name).replace(/%20/g, '-')}-i.${shopId}.${itemId}`
        : buildSearchUrl(keyword, 0)
  );

  const imageHash = basic.image || basic.images?.[0];
  const imageUrl = normalizeImageUrl(
    basic.image_url ||
      basic.cover ||
      (imageHash ? `https://down-br.img.susercontent.com/file/${imageHash}` : null)
  );

  const current = getPriceNumber(basic.price_min ?? basic.price);
  const before = getPriceNumber(basic.price_before_discount);
  const discount = before && current && before > current ? discountPercent(before, current) : null;

  return {
    externalId: `shopee-api-${shopId || 'shop'}-${itemId || index}`,
    productName: name,
    imageUrl,
    storeName: 'Shopee',
    category: classifyCategory(name),
    currentPrice: price,
    originalPrice: before && before > current ? parsePrice(before) : null,
    discountPercent: discount,
    couponCode: null,
    paymentDetails: null,
    installmentPrice: null,
    stockStatus: basic.stock === 0 ? 'Unavailable' : 'Available',
    productUrl,
    dealEndsAt: null,
    brand: basic.brand || null,
    model: null,
    specs: null,
    shippingInfo: basic.show_free_shipping ? 'Frete grátis' : null,
    rating: basic.item_rating?.rating_star ? `${Number(basic.item_rating.rating_star).toFixed(1)}/5` : null,
    reviewCount: basic.cmt_count || null,
    isFlashSale: Boolean(discount || basic.raw_discount),
    description: `${name} encontrado na Shopee por busca pública.`,
    source: 'Shopee public search'
  };
}

function extractJsonObjects(text) {
  const values = [];
  const patterns = [
    /window\.__INITIAL_STATE__\s*=\s*({.+?})\s*;<\/script>/s,
    /window\.__PAGE_STATE__\s*=\s*({.+?})\s*;<\/script>/s,
    /<script[^>]*id="__NEXT_DATA__"[^>]*>(.+?)<\/script>/s
  ];

  for (const pattern of patterns) {
    const match = String(text || '').match(pattern);
    if (!match?.[1]) continue;

    try {
      values.push(JSON.parse(match[1]));
    } catch {
      // Ignore invalid embedded states.
    }
  }

  return values;
}

function collectShopeeLikeItems(node, items = []) {
  if (!node || typeof node !== 'object') return items;

  if (
    (node.itemid || node.item_id) &&
    (node.shopid || node.shop_id) &&
    (node.name || node.title) &&
    (node.price || node.price_min)
  ) {
    items.push(node);
  }

  for (const value of Object.values(node)) {
    if (Array.isArray(value)) {
      for (const item of value) collectShopeeLikeItems(item, items);
    } else if (value && typeof value === 'object') {
      collectShopeeLikeItems(value, items);
    }
  }

  return items;
}

async function fetchShopeeApiDeals(keyword, page) {
  const newest = page * 60;
  const params = new URLSearchParams({
    by: 'relevancy',
    keyword,
    limit: '60',
    newest: String(newest),
    order: 'desc',
    page_type: 'search',
    scenario: 'PAGE_GLOBAL_SEARCH',
    version: '2'
  });
  const url = `${SHOPEE_ORIGIN}/api/v4/search/search_items?${params.toString()}`;

  const { data, status } = await axios.get(url, {
    timeout: 15000,
    validateStatus: () => true,
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'application/json,text/plain,*/*',
      'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
      Referer: buildSearchUrl(keyword, page),
      'X-Requested-With': 'XMLHttpRequest'
    }
  });

  if (status >= 400) {
    console.warn(`[shopee] API failed for "${keyword}" page=${page}: HTTP ${status}`);
    return [];
  }

  const rawItems = Array.isArray(data?.items) ? data.items : [];
  return rawItems.map((item, index) => mapApiItem(item, keyword, index)).filter(Boolean);
}

async function fetchShopeeHtmlDeals(keyword, page) {
  const url = buildSearchUrl(keyword, page);
  const { data: html, status } = await axios.get(url, {
    timeout: 15000,
    validateStatus: () => true,
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
      Referer: SHOPEE_ORIGIN
    }
  });

  if (status >= 400) {
    console.warn(`[shopee] HTML failed for "${keyword}" page=${page}: HTTP ${status}`);
    return [];
  }

  const embeddedObjects = extractJsonObjects(html);
  const items = embeddedObjects.flatMap((object) => collectShopeeLikeItems(object, []));
  const jsonDeals = items.map((item, index) => mapApiItem(item, keyword, index)).filter(Boolean);
  if (jsonDeals.length > 0) return jsonDeals;

  const $ = cheerio.load(String(html || ''));
  const links = $('a[href*="-i."]').toArray();
  const deals = [];

  for (const [index, linkEl] of links.entries()) {
    const link = $(linkEl);
    const card = link.closest('li, article, div[class*="shop-search-result"], div[class*="card"], div');
    const productUrl = cleanShopeeUrl(absoluteUrl(SHOPEE_ORIGIN, link.attr('href')));
    const productName =
      cleanText(link.attr('title')) ||
      cleanText(link.attr('aria-label')) ||
      cleanText(link.find('img[alt]').first().attr('alt')) ||
      cleanText(card.find('img[alt]').first().attr('alt')) ||
      cleanText(link.text());
    const currentPrice = parsePrice(card.text());

    if (!productUrl || !productName || !currentPrice) continue;

    deals.push({
      externalId: `shopee-html-${page}-${index}-${productUrl}`,
      productName,
      imageUrl: normalizeImageUrl(
        card.find('img').first().attr('src') ||
          card.find('img').first().attr('data-src') ||
          card.find('img').first().attr('data-lazy-src')
      ),
      storeName: 'Shopee',
      category: classifyCategory(productName),
      currentPrice,
      originalPrice: null,
      discountPercent: null,
      couponCode: null,
      paymentDetails: null,
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
      isFlashSale: /promo|oferta|desconto|cupom/i.test(card.text()),
      description: `${productName} encontrado na Shopee por HTML público.`,
      source: 'Shopee public HTML search'
    });
  }

  if (deals.length === 0) {
    console.warn(`[shopee] HTML parsed 0 usable deals for "${keyword}" page=${page}. candidateLinks=${links.length}`);
  }

  return deals;
}

export async function fetchShopeeDeals() {
  const searchTerms = resolveSearchTerms();
  const allDeals = [];

  for (const keyword of searchTerms) {
    for (const page of SEARCH_PAGES) {
      try {
        const apiDeals = await fetchShopeeApiDeals(keyword, page);
        if (apiDeals.length > 0) {
          allDeals.push(...apiDeals);
          continue;
        }

        const htmlDeals = await fetchShopeeHtmlDeals(keyword, page);
        allDeals.push(...htmlDeals);
      } catch (error) {
        console.warn(`[shopee] Failed for "${keyword}" page=${page}: ${error.response?.status || ''} ${error.message}`);
      }

      await new Promise((resolve) => setTimeout(resolve, 350));
    }
  }

  const unique = uniqueBy(allDeals, (deal) => `${deal.productUrl}|${deal.currentPrice}|${deal.productName}`);

  if (unique.length === 0) {
    console.warn('[shopee] Returned 0 deals. Shopee may be blocking Render or not exposing products in public HTML/API without browser cookies.');
  }

  return unique;
}
