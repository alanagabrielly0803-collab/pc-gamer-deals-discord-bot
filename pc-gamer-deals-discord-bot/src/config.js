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

  enableExperimentalScraping: booleanValue('ENABLE_EXPERIMENTAL_SCRAPING', false),

  includeKeywords: stringList('INCLUDE_KEYWORDS', [
    'pc gamer',
    'pc completo',
    'pc montado',
    'kit gamer',
    'notebook gamer',
    'gabinete gamer',
    'teclado gamer',
    'teclado mecanico',
    'mouse gamer',
    'mouse sem fio',
    'headset gamer',
    'headset sem fio',
    'monitor gamer',
    'monitor 144hz',
    'monitor 165hz',
    'monitor ultrawide',
    'ssd',
    'ssd nvme',
    'ssd 1tb',
    'ssd 2tb',
    'memoria ram',
    'ram ddr4',
    'ram ddr5',
    'placa de video',
    'placa de video rtx',
    'placa de video rx',
    'processador',
    'ryzen',
    'intel core',
    'fonte',
    'fonte modular',
    'water cooler',
    'cooler',
    'cadeira gamer',
    'controle xbox',
    'controle playstation',
    'microfone',
    'microfone usb',
    'webcam',
    'mousepad'
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
    'PC Case',
    'Power Supply',
    'CPU Cooler',
    'Fans',
    'RAM',
    'SSD',
    'Monitor',
    'Graphics Card',
    'Processor',
    'Motherboard',
    'Gaming Chair',
    'Controller',
    'Laptop',
    'Notebook',
    'Desktop',
    'PC Gamer',
    'Hardware',
    'Peripherals',
    'Gaming Accessory',
    'PC Gamer Accessory'
  ]),

  monitoredStores: stringList('MONITORED_STORES', [
    'Mercado Livre',
    'Amazon',
    'Kabum',
    'TerabyteShop',
    'Pichau',
    'Magazine Luiza',
    'AliExpress',
    'Shopee'
  ]),

  version: '1.1.1'
};
