export function safeUrl(url) {
  if (!url) return null;

  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

export function safeHttpsUrl(url) {
  const safe = safeUrl(url);
  if (!safe) return null;

  try {
    const parsed = new URL(safe);
    if (parsed.protocol !== 'https:') return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

export function canonicalUrl(url) {
  const safe = safeUrl(url);
  if (!safe) return null;

  try {
    const parsed = new URL(safe);
    parsed.hash = '';

    const removable = [
      'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
      'ref', 'referrer', 'source', 'tag', 'ascsubtag', 'spm', 'aff_platform',
      'aff_trace_key', 'linkCode', 'camp', 'creative', 'creativeASIN'
    ];

    for (const param of removable) {
      parsed.searchParams.delete(param);
    }

    parsed.pathname = parsed.pathname.replace(/\/+$/, '');

    return parsed.toString().toLowerCase();
  } catch {
    return safe.toLowerCase();
  }
}

export function normalizeImageUrl(url) {
  const safe = safeHttpsUrl(url);
  if (!safe) return null;

  const lower = safe.toLowerCase();

  if (lower.startsWith('data:')) return null;
  if (lower.includes('.svg')) return null;

  if (/\.(png|jpe?g|webp|avif)(\?.*)?$/i.test(lower)) return safe;

  const imageHints = [
    'images', 'image', 'img', 'cdn', 'media', 'cloudfront', 'akamai',
    'mlstatic.com', 'm.media-amazon.com', 'kabum.com.br', 'terabyteshop',
    'pichau', 'magazineluiza', 'alicdn.com', 'shopee'
  ];

  return imageHints.some((hint) => lower.includes(hint)) ? safe : null;
}

export function isLikelyProductPage(url) {
  const safe = safeUrl(url);
  if (!safe) return false;
  const lower = safe.toLowerCase();

  const forbidden = [
    '/search', '/busca', '/categoria', '/departamento', '/ofertas',
    '/promocoes', '/promoções', '/home', '/blog', '/news'
  ];

  return !forbidden.some((fragment) => lower.includes(fragment));
}
