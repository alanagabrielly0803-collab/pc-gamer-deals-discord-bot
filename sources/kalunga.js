import axios from 'axios';
import * as cheerio from 'cheerio';

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const BASE_URL = 'https://www.kalunga.com.br';

const SEARCHES = [
  ['ssd', 'SSD'],
  ['memoria-ram', 'RAM'],
  ['memoria-ram-ddr4', 'RAM'],
  ['memoria-ram-ddr5', 'RAM'],
  ['teclado-gamer', 'Gaming Keyboard'],
  ['mouse-gamer', 'Gaming Mouse'],
  ['mousepad-gamer', 'Mousepad'],
  ['headset-gamer', 'Gaming Headset'],
  ['microfone-gamer', 'Microphone'],
  ['webcam', 'Webcam'],
  ['monitor-gamer', 'Monitor'],
  ['water-cooler', 'CPU Cooler'],
  ['hub-usb', 'USB Hub'],
  ['notebook-gamer', 'Notebook'],
  ['placa-de-video', 'Graphics Card'],
  ['processador', 'Processor']
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

function absoluteUrl(href) {
  if (!href) return null;
  try {
    return new URL(href, BASE_URL).toString();
  } catch {
    return null;
  }
}

function cleanText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function extractPriceText(card, title) {
  const text = cleanText(card.text());
  const titleIndex = text.indexOf(title);
  const afterTitle = titleIndex >= 0 ? text.slice(titleIndex + title.length) : text;
  const match = afterTitle.match(/R\$\s*([\d\.]+(?:,\d{2})?)/i) || text.match(/R\$\s*([\d\.]+(?:,\d{2})?)/i);
  return match ? `R$ ${match[1]}` : null;
}

function classifyCategory(title) {
  const value = String(title || '').toLowerCase();

  if (value.includes('ssd')) return 'Armazenamento SSD';
  if (value.includes('memoria') || value.includes('ram')) return 'Memória RAM';
  if (value.includes('placa de video') || value.includes('rtx') || value.includes('radeon')) return 'Placa de vídeo';
  if (value.includes('processador') || value.includes('ryzen') || value.includes('intel')) return 'Processador';
  if (value.includes('monitor')) return 'Monitor';
  if (value.includes('teclado')) return 'Teclado gamer';
  if (value.includes('mousepad')) return 'Mousepad';
  if (value.includes('mouse')) return 'Mouse gamer';
  if (value.includes('headset') || value.includes('fone')) return 'Headset gamer';
  if (value.includes('microfone')) return 'Microfone';
  if (value.includes('webcam')) return 'Webcam';
  if (value.includes('water cooler') || value.includes('watercooler') || value.includes('cooler')) return 'Cooler';
  if (value.includes('hub usb') || value.includes('usb hub')) return 'Hub USB';
  if (value.includes('notebook') || value.includes('laptop')) return 'Notebook';

  return 'Hardware';
}

async function fetchKalungaSearch(term, page) {
  const url = `${BASE_URL}/busca/${term}/${page}`;
  const { data: html } = await axios.get(url, {
    timeout: 20000,
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml'
    }
  });

  const $ = cheerio.load(html);
  const cards = $('.blocoproduto');
  const deals = [];

  cards.each((_, el) => {
    const card = $(el);
    const link = card.find('a.blocoproduto__link[href*="/prod/"]').first();
    const title = cleanText(link.attr('title') || link.attr('aria-label') || card.find('img[alt]').first().attr('alt'));
    const href = link.attr('href');

    if (!title || !href) {
      return;
    }

    const productUrl = absoluteUrl(href);
    const currentPrice = extractPriceText(card, title);

    if (!productUrl || !currentPrice) {
      return;
    }

    const image =
      absoluteUrl(card.find('img[src*="fotosdeprodutos"]').first().attr('src')) ||
      absoluteUrl(card.find('img[data-src*="fotosdeprodutos"]').first().attr('data-src')) ||
      null;

    deals.push({
      externalId: `kalunga-${href}`,
      productName: title,
      imageUrl: image,
      storeName: 'Kalunga',
      category: classifyCategory(title),
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
      shippingInfo: null,
      rating: null,
      reviewCount: null,
      isFlashSale: /oferta|promo|desconto|off/i.test(textOf(card)),
      description: `${title} encontrado na Kalunga.`,
      source: 'Kalunga search'
    });
  });

  console.log(`[kalunga] ${term} page=${page}: cards=${cards.length}, deals=${deals.length}`);
  return deals;
}

function textOf(card) {
  return cleanText(card.text());
}

export async function fetchKalungaDeals() {
  const deals = [];

  for (const [term] of SEARCHES) {
    for (const page of [1, 2]) {
      try {
        const pageDeals = await fetchKalungaSearch(term, page);
        deals.push(...pageDeals);
      } catch (error) {
        console.warn(`[kalunga] Failed to fetch ${term} page=${page}: ${error.message}`);
      }
    }
  }

  return uniqueBy(deals, (deal) => `${deal.productUrl}|${deal.currentPrice}|${deal.productName}`);
}
