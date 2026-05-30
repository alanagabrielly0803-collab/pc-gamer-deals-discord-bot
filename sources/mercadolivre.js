import axios from 'axios';
import * as cheerio from 'cheerio';

import { config } from '../config.js';
import { discountPercent } from '../utils/price.js';

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

const HTML_PAGES = [0, 50];
const MAX_TERMS = 24;

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
    .filter((term) => !/impressora|toner|cartucho|notebook|roteador|nobreak|filtro de linha|repetidor|mesh|ps5|xbox|nintendo/i.test(term));

  return uniqueBy(terms, (term) => term).slice(0, MAX_TERMS);
}

export async function fetchMercadoLivreDeals() {
  const searchTerms = resolveSearchTerms();
  const allDeals = [];

  console.warn('[mercadolivre] Public API disabled in this build because Render is receiving HTTP 403. Using HTML fallback only.');

  for (const keyword of searchTerms) {
    const deals = await fetchMercadoLivreHtmlDeals(keyword);
    allDeals.push(...deals);
    await new Promise((resolve) => setTimeout(resolve, 350));
  }

  const unique = uniqueBy(allDeals, (deal) => `${deal.productUrl}|${deal.currentPrice}|${deal.productName}`);

  if (unique.length === 0) {
    console.warn('[mercadolivre] HTML fallback also returned 0 deals. Render IP may be blocked by Mercado Livre HTML pages too.');
  }

  return unique;
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
      const { data: html, status } = await axios.get(url, {
        timeout: 15000,
        validateStatus: () => true,
        headers: {
          'User-Agent': USER_AGENT,
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
          Referer: 'https://www.mercadolivre.com.br/'
        }
      });

      if (status >= 400) {
        console.warn(`[mercadolivre] HTML failed for "${keyword}" offset=${offset}: HTTP ${status}`);
        continue;
      }

      const $ = cheerio.load(String(html || ''));
      const links = $('a[href]').filter((_index, el) => {
        const href = String($(el).attr('href') || '');
        return /\/MLB-|\/p\/MLB|produto\.mercadolivre\.com\.br|click1\.mercadolivre\.com\.br/i.test(href);
      }).toArray();

      let accepted = 0;

      for (const [index, linkEl] of links.entries()) {
        const link = $(linkEl);
        const productUrl = cleanMercadoLivreUrl(absoluteUrl('https://www.mercadolivre.com.br', link.attr('href')));
        if (!productUrl) continue;

        const card = link.closest('li, article, div.ui-search-result, div.ui-search-layout__item, div[class*="poly-card"], div[class*="andes-card"], div');
        const title = getTitleFromCard(card, link);
        if (!title || title.length < 5) continue;

        const currentPrice = parseHtmlPrice(card);
        if (!currentPrice) continue;

        const originalPrice = parseHtmlOriginalPrice(card);
        const discount = originalPrice ? discountPercent(originalPrice, currentPrice) : null;
        const text = cleanText(card.text()).toLowerCase();

        accepted += 1;
        deals.push({
          externalId: `mlb-html-${searchSlug}-${offset}-${index}`,
          productName: title,
          imageUrl: getHtmlImageUrl(card),
          storeName: 'Mercado Livre',
          category: classifyCategory(title),
          currentPrice,
          originalPrice,
          discountPercent: discount,
          couponCode: null,
          paymentDetails: text.includes('mercado pago') ? 'Mercado Pago' : null,
          installmentPrice: null,
          stockStatus: null,
          productUrl,
          dealEndsAt: null,
          brand: null,
          model: null,
          specs: null,
          shippingInfo: /frete gr[aá]tis/i.test(text) ? 'Frete grátis' : null,
          rating: null,
          reviewCount: null,
          isFlashSale: Boolean(originalPrice && currentPrice && originalPrice > currentPrice),
          description: `${title} encontrado no Mercado Livre.`,
          source: 'Mercado Livre HTML search fallback'
        });
      }

      if (accepted === 0) {
        console.warn(`[mercadolivre] HTML parsed 0 usable deals for "${keyword}" offset=${offset}. candidateLinks=${links.length}`);
      }
    } catch (error) {
      console.warn(`[mercadolivre] HTML request failed for "${keyword}" offset=${offset}: ${error.message}`);
    }
  }

  return uniqueBy(deals, (deal) => deal.productUrl || deal.externalId);
}

function getTitleFromCard(card, link) {
  return (
    cleanText(card.find('h2, .ui-search-item__title, [class*="title"], [class*="poly-component__title"]').first().text()) ||
    cleanText(link.attr('title')) ||
    cleanText(link.attr('aria-label')) ||
    cleanText(link.find('img[alt]').first().attr('alt')) ||
    cleanText(card.find('img[alt]').first().attr('alt')) ||
    cleanText(link.text())
  );
}

function absoluteUrl(baseUrl, href) {
  if (!href) return null;
  try {
    return new URL(href, baseUrl).toString();
  } catch {
    return null;
  }
}

function cleanMercadoLivreUrl(url) {
  if (!url) return null;

  try {
    const parsed = new URL(url);

    if (parsed.hostname.includes('click1.mercadolivre.com.br')) {
      const target = parsed.searchParams.get('url') || parsed.searchParams.get('go') || parsed.searchParams.get('redirect');
      if (target) return cleanMercadoLivreUrl(target);
    }

    parsed.hash = '';
    for (const key of [...parsed.searchParams.keys()]) {
      if (/utm_|tracking|source|position|type|matt_tool|matt_word/i.test(key)) {
        parsed.searchParams.delete(key);
      }
    }

    return parsed.toString();
  } catch {
    return url;
  }
}

function getHtmlImageUrl(card) {
  const image = card.find('img').first();
  const candidates = [
    image.attr('src'),
    image.attr('data-src'),
    image.attr('data-lazy-src'),
    image.attr('data-original'),
    String(image.attr('srcset') || '').split(',').map((part) => part.trim().split(/\s+/)[0]).find(Boolean)
  ].filter(Boolean);

  const value = candidates.find(Boolean);
  return value ? value.replace('http://', 'https://') : null;
}

function parseHtmlPrice(card) {
  const text = cleanText(card.text());
  const candidates = [
    card.find('.andes-money-amount--cents-superscript, .andes-money-amount__fraction').first().text(),
    card.find('.andes-money-amount__fraction').first().text(),
    card.find('[class*="price"] .andes-money-amount__fraction').first().text(),
    text
  ];

  for (const candidate of candidates) {
    const match = String(candidate).match(/R\$\s*([\d\.]+(?:,\d{2})?)/i);
    if (match) return `R$ ${match[1]}`;
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
    if (match) return `R$ ${match[1]}`;
  }

  return null;
}
