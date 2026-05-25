import axios from 'axios';
import * as cheerio from 'cheerio';

import { config } from '../config.js';
import { discountPercent } from '../utils/price.js';

const BASE_URL = 'https://api.mercadolibre.com/sites/MLB/search';

const BOOST_SEARCH_TERMS = [
  'pc gamer',
  'pc completo',
  'pc montado',
  'kit gamer',
  'gabinete gamer',
  'notebook gamer',
  'teclado mecanico',
  'mouse sem fio',
  'headset sem fio',
  'monitor ultrawide',
  'ssd nvme',
  'ssd 1tb',
  'ssd 2tb',
  'placa de video rtx',
  'placa de video rx',
  'ryzen 7',
  'ryzen 5',
  'intel core i5',
  'intel core i7',
  'fonte modular',
  'water cooler',
  'controle xbox',
  'controle playstation',
  'microfone usb',
  'webcam'
];

const SORTS = ['relevance', 'price_asc'];

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

  return 'PC Gamer Accessory';
}

export async function fetchMercadoLivreDeals() {
  const searchTerms = Array.from(
    new Set(
      [...config.includeKeywords, ...BOOST_SEARCH_TERMS]
        .map((term) => String(term).trim().toLowerCase())
        .filter(Boolean)
    )
  ).slice(0, 40);

  const allDeals = [];

  for (let index = 0; index < searchTerms.length; index += 1) {
    const keyword = searchTerms[index];
    const sort = SORTS[index % SORTS.length];
    const deals = await fetchMercadoLivreSearchResults(keyword, sort);
    allDeals.push(...deals);
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  return allDeals;
}

async function fetchMercadoLivreSearchResults(keyword, sort) {
  try {
    const apiDeals = await fetchMercadoLivreApiDeals(keyword, sort);
    if (apiDeals.length > 0) {
      return apiDeals;
    }
  } catch {
    // Fallback to HTML below.
  }

  try {
    return await fetchMercadoLivreHtmlDeals(keyword);
  } catch {
    return [];
  }
}

async function fetchMercadoLivreApiDeals(keyword, sort) {
  const { data } = await axios.get(BASE_URL, {
    params: {
      q: keyword,
      limit: 30,
      sort
    },
    timeout: 15000,
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
      Accept: 'application/json,text/plain,*/*'
    }
  });

  const results = Array.isArray(data?.results) ? data.results : [];
  return results.map((item) => mapMercadoLivreApiItem(item));
}

async function fetchMercadoLivreHtmlDeals(keyword) {
  const searchSlug = buildMercadoLivreSearchSlug(keyword);
  const { data: html } = await axios.get(`https://lista.mercadolivre.com.br/${searchSlug}`, {
    timeout: 15000,
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml'
    }
  });

  const $ = cheerio.load(html);
  const cards = $('li.ui-search-layout__item, div.ui-search-layout__item');
  const deals = [];

  cards.each((_, cardEl) => {
    const card = $(cardEl);
    const linkEl = card.find('a.ui-search-item__group__element, a.ui-search-link, a[href*="/MLB-"]').first();
    const productUrl = linkEl.attr('href') || null;
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
      externalId: `mlb-html-${buildMercadoLivreSearchSlug(keyword)}-${deals.length}`,
      productName: title,
      imageUrl: imageUrl?.replace('http://', 'https://') || null,
      storeName: 'Mercado Livre',
      category: classifyCategory(title),
      currentPrice,
      originalPrice,
      discountPercent: discount,
      couponCode: null,
      paymentDetails: card.text().includes('Mercado Pago') ? 'Mercado Pago' : null,
      installmentPrice: null,
      stockStatus: null,
      productUrl,
      dealEndsAt: null,
      brand: null,
      model: null,
      specs: null,
      shippingInfo: card.text().includes('frete grátis') ? 'Frete grátis' : null,
      rating: null,
      reviewCount: null,
      isFlashSale: Boolean(originalPrice && currentPrice && originalPrice > currentPrice),
      description: `${title} encontrado no Mercado Livre.`,
      source: 'Mercado Livre HTML search fallback'
    });
  });

  return deals;
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

function buildMercadoLivreSearchSlug(keyword) {
  return String(keyword || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function parseHtmlPrice(card) {
  const fraction = cleanText(card.find('.andes-money-amount__fraction').first().text());
  const cents = cleanText(card.find('.andes-money-amount__cents').first().text());

  if (!fraction) {
    return null;
  }

  return cents ? `R$ ${fraction},${cents}` : `R$ ${fraction}`;
}

function parseHtmlOriginalPrice(card) {
  const previous =
    cleanText(card.find('.andes-money-amount--previous .andes-money-amount__fraction').first().text()) ||
    cleanText(card.find('.price-tag .price-tag-amount').first().text());

  if (!previous) {
    return null;
  }

  return `R$ ${previous}`;
}
