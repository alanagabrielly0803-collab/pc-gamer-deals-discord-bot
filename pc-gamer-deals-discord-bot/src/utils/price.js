export function parsePrice(value) {
  if (value === null || value === undefined || value === '') return null;

  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.round(value * 100) / 100;
  }

  let raw = String(value)
    .replace(/\s+/g, '')
    .replace(/[^\d,.-]/g, '');

  if (!raw) return null;

  const hasComma = raw.includes(',');
  const hasDot = raw.includes('.');

  if (hasComma && hasDot) {
    raw = raw.replace(/\./g, '').replace(',', '.');
  } else if (hasComma) {
    raw = raw.replace(',', '.');
  }

  const parsed = Number(raw);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : null;
}

export function formatBRL(value) {
  const price = parsePrice(value);
  if (price === null) return null;

  return price.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  });
}

export function discountPercent(originalPrice, currentPrice) {
  const original = parsePrice(originalPrice);
  const current = parsePrice(currentPrice);

  if (!original || !current || original <= current) return null;

  return Math.round(((original - current) / original) * 100);
}

export function isLowerPrice(newPrice, oldPrice) {
  const next = parsePrice(newPrice);
  const previous = parsePrice(oldPrice);

  if (next === null || previous === null) return false;

  return next < previous;
}
