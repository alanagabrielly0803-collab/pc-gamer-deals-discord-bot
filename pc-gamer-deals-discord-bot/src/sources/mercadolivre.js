import axios from 'axios';

import { config } from '../config.js';
import { discountPercent } from '../utils/price.js';

const BASE_URL = 'https://api.mercadolibre.com/sites/MLB/search';

function classifyCategory(title) {
  const value = String(title || '').toLowerCase();

  if (value.includes('teclado')) return 'Gaming Keyboard';
  if (value.includes('mousepad')) return 'Mousepad';
  if (value.includes('mouse')) return 'Gaming Mouse';
  if (value.includes('headset') || value.includes('fone')) return 'Gaming Headset';
  if (value.includes('monitor')) return 'Monitor';
  if (value.includes('ssd')) return 'SSD';
  if (value.includes('memória') || value.includes('memoria') || value.includes('ram')) return 'RAM';
  if (value.includes('placa de vídeo') || value.includes('placa de video') || value.includes('rtx') || value.includes('radeon')) return 'Graphics Card';
  if (value.includes('processador') || value.includes('ryzen') || value.includes('intel')) return 'Processor';
  if (value.includes('placa mãe') || value.includes('placa mae') || value.includes('motherboard')) return 'Motherboard';
  if (value.includes('fonte')) return 'Power Supply';
  if (value.includes('cooler') || value.includes('water cooler')) return 'CPU Cooler';
  if (value.includes('cadeira')) return 'Gaming Chair';
  if (value.includes('controle')) return 'Controller';

  return 'PC Gamer Accessory';
}

export async function fetchMercadoLivreDeals() {
  const allDeals = [];

  for (const keyword of config.includeKeywords.slice(0, 16)) {
    const { data } = await axios.get(BASE_URL, {
      params: {
        q: keyword,
        limit: 20,
        sort: 'price_asc'
      },
      timeout: 15000,
      headers: {
        'User-Agent': 'PCGamerDealsBot/1.0'
      }
    });

    const results = Array.isArray(data?.results) ? data.results : [];

    for (const item of results) {
      const originalPrice = item.original_price || null;
      const discount = originalPrice ? discountPercent(originalPrice, item.price) : null;

      allDeals.push({
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
      });
    }

    await new Promise((resolve) => setTimeout(resolve, 800));
  }

  return allDeals;
}
