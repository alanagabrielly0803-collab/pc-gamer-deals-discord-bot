import axios from 'axios';
import * as cheerio from 'cheerio';

import { config } from '../config.js';

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

const MAX_LINKS_PER_SOURCE = 120;
const PLACEHOLDER_HOSTS = new Set([
  'site-de-ofertas.com',
  'www.site-de-ofertas.com',
  'outro-site.com',
  'www.outro-site.com',
  'example.com',
  'www.example.com',
  'exemplo.com',
  'www.exemplo.com'
]);

function cleanText(value, maxLength = 220) {
  const text = String(value || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();

  if (!text) return null;
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
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

function isValidSourceUrl(value) {
  try {
    const parsed = new URL(String(value || '').trim());
    if (!['http:', 'https:'].includes(parsed.protocol)) return false;
    if (PLACEHOLDER_HOSTS.has(parsed.hostname.toLowerCase())) return false;
    return true;
  } catch {
    return false;
  }
}

function filterConfiguredUrls(urls, label) {
  const valid = [];

  for (const url of urls || []) {
    if (isValidSourceUrl(url)) {
      valid.push(url);
    } else if (url) {
      console.warn(`[public-shopee] Ignoring invalid ${label}: ${url}`);
    }
  }

  return uniqueBy(valid, (url) => url);
}

function isDirectShopeeUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.hostname === 'shopee.com.br' || parsed.hostname.endsWith('.shopee.com.br');
  } catch {
    return false;
  }
}

function findDirectShopeeUrl(value, baseUrl) {
  const absolute = absoluteUrl(baseUrl, value) || String(value || '');
  if (isDirectShopeeUrl(absolute)) return cleanShopeeUrl(absolute);

  const match = String(value || '').match(/https?:\/\/[^\s"'<>]*shopee\.com\.br\/[^\s"'<>]+/i);
  if (match?.[0] && isDirectShopeeUrl(match[0])) return cleanShopeeUrl(match[0]);

  return null;
}

function hasShopeeSignal(value) {
  return /\bshopee\b|shope\.com\.br|shopee\.com\.br/i.test(String(value || ''));
}

function cleanShopeeUrl(url) {
  if (!url) return null;

  try {
    const parsed = new URL(url);
    parsed.hash = '';

    for (const key of [...parsed.searchParams.keys()]) {
      if (/utm_|sp_atk|xptdk|uls_trackid|source|search/i.test(key)) {
        parsed.searchParams.delete(key);
      }
    }

    return parsed.toString();
  } catch {
    return url;
  }
}

function normalizeImageUrl(value, baseUrl) {
  const url = absoluteUrl(baseUrl, value) || String(value || '').replace(/^\/\//, 'https://');
  if (!/^https?:\/\//i.test(url)) return null;
  if (/logo|banner|placeholder|sprite|icon|avatar/i.test(url)) return null;
  return url.replace('http://', 'https://');
}

function parsePrice(value) {
  const text = String(value || '');
  const match = text.match(/R\$\s*([\d\.]+(?:,\d{2})?)/i) || text.match(/(?:^|\s)([\d\.]+,\d{2})(?:\s|$)/);
  if (!match) return null;
  return `R$ ${match[1]}`;
}

function inferCategory(name, description = '') {
  const value = `${name} ${description}`.toLowerCase();

  if (value.includes('ssd')) return 'Armazenamento SSD';
  if (value.includes('memoria') || value.includes('memória') || value.includes('ram')) return 'Memória RAM';
  if (value.includes('placa mae') || value.includes('placa mãe')) return 'Placa-mãe';
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

function getCardForLink($, link) {
  return link.closest('article, li, tr, div[class*="offer"], div[class*="deal"], div[class*="promo"], div[class*="card"], div[class*="post"], div[class*="thread"], div');
}

function getTitleFromCard(card, link) {
  return (
    cleanText(link.attr('title')) ||
    cleanText(link.attr('aria-label')) ||
    cleanText(link.find('img[alt]').first().attr('alt')) ||
    cleanText(card.find('img[alt]').first().attr('alt')) ||
    cleanText(card.find('h1, h2, h3, h4, [class*="title"], [class*="name"], [class*="produto"], [class*="product"]').first().text()) ||
    cleanText(link.text())
  );
}

function getImageFromCard(card, baseUrl) {
  const image = card.find('img').first();
  const candidates = [
    image.attr('src'),
    image.attr('data-src'),
    image.attr('data-lazy-src'),
    image.attr('data-original'),
    String(image.attr('srcset') || '').split(',').map((part) => part.trim().split(/\s+/)[0]).find(Boolean)
  ].filter(Boolean);

  for (const candidate of candidates) {
    const imageUrl = normalizeImageUrl(candidate, baseUrl);
    if (imageUrl) return imageUrl;
  }

  return null;
}

function getPublicOfferUrl(rawHref, sourceUrl) {
  const directShopeeUrl = findDirectShopeeUrl(rawHref, sourceUrl);
  if (directShopeeUrl) return directShopeeUrl;

  const publicUrl = absoluteUrl(sourceUrl, rawHref);
  if (!publicUrl) return null;

  try {
    const sourceHost = new URL(sourceUrl).hostname.replace(/^www\./, '');
    const linkHost = new URL(publicUrl).hostname.replace(/^www\./, '');
    const sameSource = linkHost === sourceHost;
    const knownRedirect = /pelando|promobit|hardmob|gatry|promoby|dpl\.pelando/i.test(linkHost);

    return sameSource || knownRedirect ? publicUrl : null;
  } catch {
    return null;
  }
}

function isCandidateShopeeLink($, linkEl, sourceUrl) {
  const link = $(linkEl);
  const href = link.attr('href');
  const directShopeeUrl = findDirectShopeeUrl(href, sourceUrl);
  if (directShopeeUrl) return true;

  const card = getCardForLink($, link);
  const text = `${href || ''} ${link.attr('title') || ''} ${link.attr('aria-label') || ''} ${link.text() || ''} ${card.text() || ''}`;
  return hasShopeeSignal(text) && Boolean(getPublicOfferUrl(href, sourceUrl));
}

function mapHtmlDeal({ $, linkEl, sourceUrl, index }) {
  const link = $(linkEl);
  const href = link.attr('href');
  const card = getCardForLink($, link);
  const cardText = cleanText(card.text(), 2000) || '';
  const linkText = cleanText(`${link.attr('title') || ''} ${link.attr('aria-label') || ''} ${link.text() || ''}`, 500) || '';
  const publicOfferUrl = getPublicOfferUrl(href, sourceUrl);
  const directShopeeUrl = findDirectShopeeUrl(href, sourceUrl) || findDirectShopeeUrl(cardText, sourceUrl);
  const productUrl = directShopeeUrl || publicOfferUrl;

  if (!productUrl || !hasShopeeSignal(`${href || ''} ${cardText} ${linkText}`)) return null;

  const productName = getTitleFromCard(card, link);
  const currentPrice = parsePrice(cardText || linkText);

  if (!productName || !currentPrice) return null;

  return {
    externalId: `public-shopee-${index}-${productUrl}`,
    productName,
    imageUrl: getImageFromCard(card, sourceUrl),
    storeName: 'Shopee',
    category: inferCategory(productName, cardText),
    currentPrice,
    originalPrice: null,
    discountPercent: null,
    couponCode: /cupom/i.test(cardText) ? 'Cupom na fonte pública' : null,
    paymentDetails: null,
    installmentPrice: null,
    stockStatus: null,
    productUrl,
    dealEndsAt: null,
    brand: null,
    model: null,
    specs: null,
    shippingInfo: /frete gr[aá]tis/i.test(cardText) ? 'Frete grátis' : null,
    rating: null,
    reviewCount: null,
    isFlashSale: /promo|oferta|desconto|cupom|menor preço|menor preco/i.test(cardText),
    description: `${productName} encontrado em fonte pública: ${sourceUrl}`,
    source: 'Public web source Shopee link',
    sourcePageUrl: sourceUrl,
    skipPageHealth: true
  };
}

async function fetchPublicHtmlSource(sourceUrl) {
  const { data: html, status } = await axios.get(sourceUrl, {
    timeout: 15000,
    validateStatus: () => true,
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7'
    }
  });

  if (status >= 400) {
    console.warn(`[public-shopee] Source failed ${sourceUrl}: HTTP ${status}`);
    return [];
  }

  const $ = cheerio.load(String(html || ''));
  const links = $('a[href]').filter((_index, el) => isCandidateShopeeLink($, el, sourceUrl)).slice(0, MAX_LINKS_PER_SOURCE).toArray();
  const deals = links.map((linkEl, index) => mapHtmlDeal({ $, linkEl, sourceUrl, index })).filter(Boolean);

  if (deals.length === 0) {
    console.warn(`[public-shopee] Parsed 0 usable Shopee deals from ${sourceUrl}. candidateLinks=${links.length}`);
  }

  return deals;
}

function mapRssDeal({ item, feedUrl, index }) {
  const title = cleanText(item.find('title').first().text());
  const description = item.find('description, content\\:encoded, encoded').first().text();
  const linkText = item.find('link').first().text() || item.find('guid').first().text();
  const combined = `${title || ''} ${description || ''} ${linkText || ''}`;
  const directShopeeUrl = findDirectShopeeUrl(linkText, feedUrl) || findDirectShopeeUrl(combined, feedUrl);
  const publicOfferUrl = getPublicOfferUrl(linkText, feedUrl);
  const productUrl = directShopeeUrl || publicOfferUrl;

  if (!productUrl || !title || !hasShopeeSignal(combined)) return null;

  const currentPrice = parsePrice(combined);
  if (!currentPrice) return null;

  return {
    externalId: `rss-shopee-${index}-${productUrl}`,
    productName: title,
    imageUrl: null,
    storeName: 'Shopee',
    category: inferCategory(title, description),
    currentPrice,
    originalPrice: null,
    discountPercent: null,
    couponCode: /cupom/i.test(combined) ? 'Cupom na fonte pública' : null,
    paymentDetails: null,
    installmentPrice: null,
    stockStatus: null,
    productUrl: cleanShopeeUrl(productUrl),
    dealEndsAt: null,
    brand: null,
    model: null,
    specs: null,
    shippingInfo: /frete gr[aá]tis/i.test(combined) ? 'Frete grátis' : null,
    rating: null,
    reviewCount: null,
    isFlashSale: /promo|oferta|desconto|cupom|menor preço|menor preco/i.test(combined),
    description: `${title} encontrado em RSS público: ${feedUrl}`,
    source: 'Public RSS Shopee link',
    sourcePageUrl: feedUrl,
    skipPageHealth: true
  };
}

async function fetchPublicRssSource(feedUrl) {
  const { data: xml, status } = await axios.get(feedUrl, {
    timeout: 15000,
    validateStatus: () => true,
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'application/rss+xml,application/xml,text/xml,*/*',
      'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7'
    }
  });

  if (status >= 400) {
    console.warn(`[public-shopee] RSS failed ${feedUrl}: HTTP ${status}`);
    return [];
  }

  const $ = cheerio.load(String(xml || ''), { xmlMode: true });
  const deals = $('item, entry').toArray().map((item, index) => mapRssDeal({ item: $(item), feedUrl, index })).filter(Boolean);

  if (deals.length === 0) {
    console.warn(`[public-shopee] Parsed 0 usable Shopee deals from RSS ${feedUrl}. items=${$('item, entry').length}`);
  }

  return deals;
}

export async function fetchPublicShopeeDeals() {
  const publicUrls = filterConfiguredUrls(config.publicSourceUrls || [], 'PUBLIC_SOURCE_URLS');
  const rssUrls = filterConfiguredUrls(config.rssSourceUrls || [], 'RSS_SOURCE_URLS');

  if (publicUrls.length === 0 && rssUrls.length === 0) {
    console.warn('[public-shopee] No valid PUBLIC_SOURCE_URLS or RSS_SOURCE_URLS configured.');
    return [];
  }

  const deals = [];

  for (const sourceUrl of publicUrls) {
    try {
      deals.push(...(await fetchPublicHtmlSource(sourceUrl)));
    } catch (error) {
      console.warn(`[public-shopee] Source request failed ${sourceUrl}: ${error.response?.status || ''} ${error.message}`);
    }
  }

  for (const feedUrl of rssUrls) {
    try {
      deals.push(...(await fetchPublicRssSource(feedUrl)));
    } catch (error) {
      console.warn(`[public-shopee] RSS request failed ${feedUrl}: ${error.response?.status || ''} ${error.message}`);
    }
  }

  return uniqueBy(deals, (deal) => `${deal.productUrl}|${deal.currentPrice}|${deal.productName}`);
}
