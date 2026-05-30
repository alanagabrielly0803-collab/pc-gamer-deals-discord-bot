import axios from 'axios';
import * as cheerio from 'cheerio';

import { canonicalUrl, normalizeImageUrl } from './url.js';

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

const DEAD_BODY_PATTERNS = [
  /page not found/i,
  /404/i,
  /not found/i,
  /produto não encontrado/i,
  /produto nao encontrado/i,
  /página não encontrada/i,
  /pagina nao encontrada/i,
  /essa página não existe/i,
  /essa pagina nao existe/i,
  /conteúdo não encontrado/i,
  /conteudo nao encontrado/i,
  /link expirado/i
];

const BAD_IMAGE_PATTERNS = [
  /logo/i,
  /banner/i,
  /sprite/i,
  /placeholder/i,
  /loading/i,
  /no-?image/i,
  /sem-?foto/i,
  /categoria/i,
  /category/i,
  /brand/i,
  /marca/i,
  /icon/i,
  /avatar/i
];

const PRODUCT_IMAGE_HINTS = [
  'fotosdeprodutos',
  '/produto/',
  '/product/',
  '/products/',
  'product-images',
  'catalog/product',
  'mlstatic.com',
  'kabum.com.br',
  'terabyteshop',
  'images.tcdn.com.br',
  'media.pichau.com.br'
];

function cleanText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function getResponseUrl(response, fallbackUrl) {
  return (
    response?.request?.res?.responseUrl ||
    response?.request?.responseURL ||
    response?.config?.url ||
    fallbackUrl
  );
}

function getProductSignals($, html) {
  const ogType = cleanText($('meta[property="og:type"]').attr('content')).toLowerCase();
  const canonical = cleanText($('link[rel="canonical"]').attr('href'));
  const jsonLd = $('script[type="application/ld+json"]')
    .map((_index, el) => cleanText($(el).text()))
    .get()
    .join(' ');

  const hasProductSchema =
    /"@type"\s*:\s*"Product"/i.test(jsonLd) ||
    /itemtype\s*=\s*["'][^"']*schema\.org\/Product/i.test(html);

  const hasProductOgType = ogType === 'product';

  return {
    hasProductSchema,
    hasProductOgType,
    canonical
  };
}

function looksLikeDeadPage(html) {
  const $ = cheerio.load(html || '');
  const title = cleanText($('title').first().text());
  const bodyText = cleanText($('body').text() || html);
  const combined = `${title} ${bodyText}`.toLowerCase();
  const signals = getProductSignals($, html || '');

  const hasDeadLanguage = DEAD_BODY_PATTERNS.some((pattern) => pattern.test(combined));
  const hasProductSignals = signals.hasProductSchema || signals.hasProductOgType;

  if (hasDeadLanguage && !hasProductSignals) {
    return {
      dead: true,
      reason: 'soft_404',
      title
    };
  }

  if (!hasProductSignals && /404|not found|não encontrado|nao encontrado/i.test(title)) {
    return {
      dead: true,
      reason: 'dead_title',
      title
    };
  }

  return { dead: false, reason: null, title };
}

function absoluteUrl(baseUrl, value) {
  if (!value) return null;

  try {
    return new URL(value, baseUrl).toString();
  } catch {
    return null;
  }
}

function normalizeCandidateImage(baseUrl, value) {
  const absolute = absoluteUrl(baseUrl, value);
  const normalized = normalizeImageUrl(absolute);
  if (!normalized) return null;

  const lower = normalized.toLowerCase();
  if (BAD_IMAGE_PATTERNS.some((pattern) => pattern.test(lower))) return null;

  return normalized;
}

function addImageCandidate(candidates, baseUrl, value, source, priority = 0) {
  const normalized = normalizeCandidateImage(baseUrl, value);
  if (!normalized) return;

  candidates.push({ url: normalized, source, priority: priority + getImageUrlScore(normalized) });
}

function getImageUrlScore(url) {
  const lower = String(url || '').toLowerCase();
  let score = 0;

  for (const hint of PRODUCT_IMAGE_HINTS) {
    if (lower.includes(hint)) score += 3;
  }

  if (/\.(png|jpe?g|webp|avif)(\?.*)?$/i.test(lower)) score += 2;
  if (lower.includes('thumb')) score -= 1;
  if (lower.includes('small')) score -= 1;

  return score;
}

function parseSrcset(value) {
  return String(value || '')
    .split(',')
    .map((part) => part.trim().split(/\s+/)[0])
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

function getJsonLdProducts($) {
  const products = [];

  $('script[type="application/ld+json"]').each((_index, el) => {
    const raw = $(el).contents().text();
    if (!raw) return;

    try {
      const parsed = JSON.parse(raw);
      const nodes = Array.isArray(parsed) ? parsed : [parsed];
      for (const node of nodes) collectProductNodes(node, products);
    } catch {
      // Ignore invalid JSON-LD blocks.
    }
  });

  return products;
}

function getProductTitle($) {
  return (
    cleanText($('meta[property="og:title"]').attr('content')) ||
    cleanText($('meta[name="twitter:title"]').attr('content')) ||
    cleanText($('h1').first().text()) ||
    cleanText($('title').first().text()) ||
    null
  );
}

function extractMainImage($, html, baseUrl) {
  const candidates = [];

  for (const product of getJsonLdProducts($)) {
    const images = Array.isArray(product.image) ? product.image : [product.image];
    for (const image of images.filter(Boolean)) {
      addImageCandidate(candidates, baseUrl, image, 'json_ld_product', 30);
    }
  }

  addImageCandidate(candidates, baseUrl, $('meta[property="og:image:secure_url"]').attr('content'), 'og_image_secure', 25);
  addImageCandidate(candidates, baseUrl, $('meta[property="og:image"]').attr('content'), 'og_image', 24);
  addImageCandidate(candidates, baseUrl, $('meta[name="twitter:image"]').attr('content'), 'twitter_image', 23);
  addImageCandidate(candidates, baseUrl, $('link[rel="image_src"]').attr('href'), 'image_src', 20);

  const selectors = [
    'img[itemprop="image"]',
    'img[data-testid*="product"]',
    'img[class*="product"]',
    'img[class*="Produto"]',
    'img[id*="product"]',
    'img[id*="Produto"]',
    'img[src*="fotosdeprodutos"]',
    'img[data-src*="fotosdeprodutos"]',
    'img[src*="/produto/"]',
    'img[data-src*="/produto/"]',
    'img[src*="mlstatic.com"]',
    'img[data-src*="mlstatic.com"]',
    'img[src*="terabyteshop"]',
    'img[data-src*="terabyteshop"]'
  ];

  for (const selector of selectors) {
    $(selector).each((_index, el) => {
      const image = $(el);
      addImageCandidate(candidates, baseUrl, image.attr('src'), selector, 12);
      addImageCandidate(candidates, baseUrl, image.attr('data-src'), selector, 12);
      addImageCandidate(candidates, baseUrl, image.attr('data-lazy-src'), selector, 12);
      addImageCandidate(candidates, baseUrl, image.attr('data-original'), selector, 12);

      for (const srcsetUrl of parseSrcset(image.attr('srcset') || image.attr('data-srcset'))) {
        addImageCandidate(candidates, baseUrl, srcsetUrl, `${selector}:srcset`, 13);
      }
    });
  }

  if (candidates.length === 0) {
    $('img').slice(0, 40).each((_index, el) => {
      const image = $(el);
      addImageCandidate(candidates, baseUrl, image.attr('src'), 'fallback_img', 1);
      addImageCandidate(candidates, baseUrl, image.attr('data-src'), 'fallback_img', 1);
    });
  }

  const unique = new Map();
  for (const candidate of candidates) {
    const previous = unique.get(candidate.url);
    if (!previous || candidate.priority > previous.priority) {
      unique.set(candidate.url, candidate);
    }
  }

  const sorted = [...unique.values()].sort((a, b) => b.priority - a.priority);
  return sorted[0]?.url || null;
}

export async function verifyProductPage(url) {
  const checkedAt = new Date().toISOString();

  try {
    const response = await axios.get(url, {
      timeout: 15000,
      maxRedirects: 5,
      responseType: 'text',
      validateStatus: () => true,
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml'
      }
    });

    const finalUrl = getResponseUrl(response, url);
    const status = Number(response.status) || 0;
    const body = typeof response.data === 'string' ? response.data : String(response.data || '');
    const canonical = canonicalUrl(finalUrl);

    if ([404, 410, 451].includes(status)) {
      return {
        ok: false,
        cacheable: true,
        reason: `http_${status}`,
        status,
        finalUrl,
        canonicalUrl: canonical,
        checkedAt
      };
    }

    if (status >= 500) {
      return {
        ok: false,
        cacheable: false,
        reason: `http_${status}`,
        status,
        finalUrl,
        canonicalUrl: canonical,
        checkedAt
      };
    }

    const html = String(body || '');
    const $ = cheerio.load(html);
    const deadCheck = looksLikeDeadPage(html);

    if (deadCheck.dead) {
      return {
        ok: false,
        cacheable: true,
        reason: deadCheck.reason,
        status,
        finalUrl,
        canonicalUrl: canonical,
        checkedAt
      };
    }

    return {
      ok: true,
      cacheable: false,
      reason: 'live',
      status,
      finalUrl,
      canonicalUrl: canonical,
      checkedAt,
      productTitle: getProductTitle($),
      imageUrl: extractMainImage($, html, finalUrl)
    };
  } catch (error) {
    return {
      ok: false,
      cacheable: false,
      reason: 'request_failed',
      error: error?.message || String(error),
      status: null,
      finalUrl: url,
      canonicalUrl: canonicalUrl(url),
      checkedAt
    };
  }
}
