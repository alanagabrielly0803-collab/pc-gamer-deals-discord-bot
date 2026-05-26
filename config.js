import dotenv from 'dotenv';

dotenv.config();

function required(name) {
  const value = process.env[name];
  if (!value || value.trim() === '') {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value.trim();
}

function numberValue(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === null || raw === '') return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function stringList(name, fallback) {
  const raw = process.env[name];
  if (!raw || raw.trim() === '') return fallback;
  return raw.split(',').map((v) => v.trim()).filter(Boolean);
}

function booleanValue(name, fallback = false) {
  const raw = process.env[name];
  if (!raw) return fallback;
  return ['true', '1', 'yes', 'y'].includes(raw.toLowerCase());
}

export const config = {
  discordToken: required('DISCORD_TOKEN'),
  clientId: required('CLIENT_ID'),
  guildId: required('GUILD_ID'),
  channelId: required('CHANNEL_ID'),

  port: numberValue('PORT', 3000),
  checkIntervalMinutes: Math.max(5, numberValue('CHECK_INTERVAL_MINUTES', 30)),
  maxPostsPerCheck: Math.max(1, numberValue('MAX_POSTS_PER_CHECK', 20)),
  minDiscountPercent: Math.max(0, numberValue('MIN_DISCOUNT_PERCENT', 5)),
  maxPrice: numberValue('MAX_PRICE', null),

  enableExperimentalScraping: booleanValue('ENABLE_EXPERIMENTAL_SCRAPING', true),

  includeKeywords: stringList('INCLUDE_KEYWORDS', [
    'teclado gamer',
    'teclado mecanico',
    'mouse gamer',
    'mouse sem fio',
    'mouse wireless',
    'headset gamer',
    'fone gamer',
    'headset sem fio',
    'fone sem fio',
    'microfone gamer',
    'microfone usb',
    'webcam',
    'webcam full hd',
    'mousepad',
    'mousepad gamer',
    'desk mat',
    'controle gamer',
    'controle xbox',
    'controle playstation',
    'volante gamer',
    'hub usb',
    'usb hub',
    'capture card',
    'placa de captura',
    'suporte para headset',
    'base carregamento',
    'carregador sem fio',
    'braço articulado',
    'stream deck',
    'cadeira gamer',
    'cadeira ergonômica',
    'cadeira ergonomica',
    'mesa gamer',
    'ring light',
    'microfone condensador',
    'mouse bungee',
    'paracord mouse',
    'cabo usb c',
    'cabo usb',
    'teclado mecanico',
    'kit teclado mouse'
  ]),

  excludeKeywords: stringList('EXCLUDE_KEYWORDS', [
    'usado',
    'recondicionado',
    'refurbished',
    'defeito',
    'quebrado',
    'capinha',
    'pelicula',
    'suporte celular',
    'celular',
    'smartphone',
    'tablet',
    'iphone',
    'android'
  ]),

  monitoredCategories: stringList('MONITORED_CATEGORIES', [
    'Gaming Keyboard',
    'Gaming Mouse',
    'Gaming Headset',
    'Mousepad',
    'Gaming Chair',
    'Controller',
    'Microphone',
    'Webcam',
    'USB Hub',
    'Capture Card',
    'Desk Mat',
    'Gaming Accessory',
    'Peripherals',
    'PC Gamer Accessory',
    'Streaming',
    'Audio',
    'Accessories'
  ]),

  monitoredStores: stringList('MONITORED_STORES', [
    'Mercado Livre',
    'Kalunga',
    'Amazon',
    'Kabum',
    'TerabyteShop',
    'Pichau',
    'Magazine Luiza',
    'AliExpress',
    'Shopee'
  ]),

  version: '1.1.2'
};
