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
  maxPostsPerCheck: Math.max(1, numberValue('MAX_POSTS_PER_CHECK', 10)),
  minDiscountPercent: Math.max(0, numberValue('MIN_DISCOUNT_PERCENT', 10)),
  maxPrice: numberValue('MAX_PRICE', null),

  enableExperimentalScraping: booleanValue('ENABLE_EXPERIMENTAL_SCRAPING', false),

  includeKeywords: stringList('INCLUDE_KEYWORDS', [
    'teclado gamer',
    'mouse gamer',
    'headset gamer',
    'monitor gamer',
    'ssd nvme',
    'placa de video',
    'processador',
    'memoria ram ddr4',
    'memoria ram ddr5',
    'fonte 650w',
    'water cooler',
    'cadeira gamer'
  ]),

  excludeKeywords: stringList('EXCLUDE_KEYWORDS', [
    'usado',
    'recondicionado',
    'defeito',
    'carcaça',
    'película',
    'capinha',
    'suporte celular'
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

  version: '1.0.0'
};
