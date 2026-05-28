import axios from 'axios';
import * as cheerio from 'cheerio';

import { canonicalUrl } from './url.js';

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
      checkedAt
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
