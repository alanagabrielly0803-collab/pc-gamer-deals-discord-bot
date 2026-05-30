import axios from 'axios';
import sharp from 'sharp';

const WIDTH = 1080;
const HEIGHT = 1440;

const storeAccent = {
  Kabum: '#ff6500',
  Kalunga: '#00a8e8',
  Shopee: '#ee4d2d',
  Terabyte: '#00a0df',
  'Mercado Livre': '#ffe600'
};

function escapeXml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function stripPrice(value) {
  const text = String(value ?? '').trim();
  if (!text) return null;
  return text.replace(/\s+/g, ' ');
}

function truncate(value, maxLength) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1).trim()}…`;
}

function wrapText(value, maxCharsPerLine, maxLines) {
  const words = String(value ?? '').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  const lines = [];
  let line = '';

  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > maxCharsPerLine && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }

    if (lines.length >= maxLines) break;
  }

  if (line && lines.length < maxLines) lines.push(line);

  if (lines.length === maxLines && words.join(' ').length > lines.join(' ').length) {
    lines[lines.length - 1] = truncate(lines[lines.length - 1], Math.max(8, maxCharsPerLine - 1));
  }

  return lines;
}

async function fetchImageBuffer(url) {
  if (!url) return null;

  try {
    const { data, status, headers } = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 12000,
      validateStatus: () => true,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36',
        Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
      }
    });

    const type = String(headers?.['content-type'] || '');
    if (status >= 400 || !type.startsWith('image/')) return null;

    return Buffer.from(data);
  } catch {
    return null;
  }
}

async function createProductImageLayer(imageUrl) {
  const image = await fetchImageBuffer(imageUrl);

  if (!image) {
    return Buffer.from(`
      <svg width="440" height="560" viewBox="0 0 440 560" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stop-color="#18213f"/>
            <stop offset="1" stop-color="#050713"/>
          </linearGradient>
        </defs>
        <rect width="440" height="560" rx="34" fill="url(#g)"/>
        <circle cx="220" cy="230" r="96" fill="#ffffff" opacity="0.06"/>
        <text x="220" y="255" text-anchor="middle" font-family="Arial" font-size="42" font-weight="900" fill="#ffffff" opacity="0.92">OFERTA</text>
        <text x="220" y="306" text-anchor="middle" font-family="Arial" font-size="22" fill="#94a3b8">imagem indisponível</text>
      </svg>
    `);
  }

  return sharp(image)
    .resize(440, 560, { fit: 'contain', background: { r: 7, g: 11, b: 25, alpha: 1 } })
    .png()
    .toBuffer();
}

function infoBox(label, value, x, y, width = 430) {
  if (!value) return '';

  return `
    <g>
      <rect x="${x}" y="${y}" width="${width}" height="112" rx="24" fill="rgba(255,255,255,0.065)" stroke="rgba(255,255,255,0.13)"/>
      <text x="${x + 28}" y="${y + 40}" font-family="Arial" font-size="20" font-weight="800" fill="#a78bfa" letter-spacing="1.6">${escapeXml(label.toUpperCase())}</text>
      <text x="${x + 28}" y="${y + 82}" font-family="Arial" font-size="32" font-weight="900" fill="#ffffff">${escapeXml(truncate(value, 24))}</text>
    </g>
  `;
}

function buildSvg(deal) {
  const accent = storeAccent[deal.storeName] || '#8b5cf6';
  const productName = truncate(deal.productName || 'Oferta de informática', 86);
  const nameLines = wrapText(productName, 17, 4);
  const price = stripPrice(deal.currentPriceText || deal.currentPrice) || 'Preço no site';
  const original = stripPrice(deal.originalPriceText || deal.originalPrice);
  const discount = deal.discountPercent !== null && deal.discountPercent !== undefined ? `${deal.discountPercent}% OFF` : 'OFERTA';
  const category = deal.category || 'Informática';
  const store = deal.storeName || 'Loja';
  const shipping = deal.shippingInfo || deal.paymentDetails || deal.couponCode || 'Confira no site';

  const titleText = nameLines
    .map((line, index) => `<text x="58" y="${310 + index * 62}" font-family="Arial" font-size="54" font-weight="900" fill="#ffffff">${escapeXml(line)}</text>`)
    .join('');

  return `
  <svg width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <radialGradient id="bg1" cx="85%" cy="12%" r="85%">
        <stop offset="0" stop-color="${accent}" stop-opacity="0.48"/>
        <stop offset="0.42" stop-color="#111a38" stop-opacity="0.92"/>
        <stop offset="1" stop-color="#050713"/>
      </radialGradient>
      <linearGradient id="cta" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="#6d28d9"/>
        <stop offset="0.55" stop-color="#8b5cf6"/>
        <stop offset="1" stop-color="${accent}"/>
      </linearGradient>
      <filter id="glow">
        <feGaussianBlur stdDeviation="10" result="blur"/>
        <feMerge>
          <feMergeNode in="blur"/>
          <feMergeNode in="SourceGraphic"/>
        </feMerge>
      </filter>
    </defs>

    <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#bg1)"/>
    <circle cx="930" cy="170" r="220" fill="${accent}" opacity="0.16" filter="url(#glow)"/>
    <circle cx="125" cy="1260" r="260" fill="#8b5cf6" opacity="0.12" filter="url(#glow)"/>

    <rect x="42" y="42" width="996" height="1356" rx="44" fill="rgba(255,255,255,0.035)" stroke="rgba(255,255,255,0.12)"/>

    <text x="58" y="112" font-family="Arial" font-size="26" font-weight="900" fill="${accent}" letter-spacing="4">OFERTA GAMER</text>
    <rect x="750" y="62" width="230" height="86" rx="24" fill="${accent}" opacity="0.96"/>
    <text x="865" y="116" text-anchor="middle" font-family="Arial" font-size="28" font-weight="900" fill="#07111f">${escapeXml(discount)}</text>

    <text x="58" y="205" font-family="Arial" font-size="94" font-weight="900" fill="#ffffff">ACHADO</text>
    <text x="58" y="276" font-family="Arial" font-size="64" font-weight="900" fill="${accent}" font-style="italic">IMPERDÍVEL</text>

    ${titleText}

    <g>
      <rect x="580" y="250" width="440" height="560" rx="34" fill="rgba(5,7,19,0.92)" stroke="rgba(255,255,255,0.12)"/>
    </g>

    ${infoBox('Loja', store, 58, 610)}
    ${infoBox('Categoria', category, 58, 744)}
    ${infoBox('Condição', shipping, 58, 878)}

    <rect x="58" y="1050" width="964" height="148" rx="34" fill="rgba(0,0,0,0.30)" stroke="rgba(255,255,255,0.12)"/>
    <text x="88" y="1102" font-family="Arial" font-size="24" font-weight="900" fill="#94a3b8">PREÇO ATUAL</text>
    <text x="88" y="1168" font-family="Arial" font-size="66" font-weight="900" fill="#ffffff">${escapeXml(price)}</text>
    ${original ? `<text x="620" y="1160" font-family="Arial" font-size="30" fill="#cbd5e1" text-decoration="line-through">De ${escapeXml(original)}</text>` : ''}

    <rect x="58" y="1230" width="964" height="104" rx="30" fill="url(#cta)" filter="url(#glow)"/>
    <text x="540" y="1296" text-anchor="middle" font-family="Arial" font-size="42" font-weight="900" fill="#ffffff">VER OFERTA AGORA</text>

    <text x="540" y="1370" text-anchor="middle" font-family="Arial" font-size="22" fill="#cbd5e1">Preço pode mudar a qualquer momento • Confira antes de comprar</text>
  </svg>`;
}

export async function generateDealCard(deal) {
  const svg = Buffer.from(buildSvg(deal));
  const productLayer = await createProductImageLayer(deal.imageUrl);

  return sharp(svg)
    .composite([
      {
        input: productLayer,
        left: 580,
        top: 250
      }
    ])
    .png()
    .toBuffer();
}
