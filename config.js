import dotenv from 'dotenv';

import {
  DISCOVERY_TERMS,
  EXCLUDE_KEYWORDS,
  MONITORED_CATEGORIES
} from './utils/dealTaxonomy.js';

dotenv.config();

function envFlag(name) {
  const raw = process.env[name];
  if (!raw) return false;
  return ['true', '1', 'yes', 'y', 'on'].includes(raw.toLowerCase());
}

function envFlagDefault(name, fallback) {
  const raw = process.env[name];
  if (!raw) return fallback;
  return ['true', '1', 'yes', 'y', 'on'].includes(raw.toLowerCase());
}

const mode = String(process.env.BOT_MODE || '').trim().toLowerCase() || 'discord';
const testMode = mode === 'test' || envFlag('DISCORD_DISABLED');

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

function enumValue(name, allowed, fallback) {
  const raw = String(process.env[name] || '').trim().toLowerCase();
  return allowed.includes(raw) ? raw : fallback;
}

const sourceFlags = {
  mercadoLivre: envFlagDefault('ENABLE_MERCADO_LIVRE', false),
  kabum: envFlagDefault('ENABLE_KABUM', true),
  kalunga: envFlagDefault('ENABLE_KALUNGA', true),
  terabyte: envFlagDefault('ENABLE_TERABYTE', false),
  shopee: envFlagDefault('ENABLE_SHOPEE', false)
};

export const config = {
  mode,
  discordEnabled: !testMode,
  discordToken: testMode ? null : required('DISCORD_TOKEN'),
  clientId: testMode ? null : required('CLIENT_ID'),
  guildId: testMode ? null : required('GUILD_ID'),
  channelId: testMode ? null : required('CHANNEL_ID'),

  port: numberValue('PORT', 3000),
  checkIntervalMinutes: Math.max(5, numberValue('CHECK_INTERVAL_MINUTES', 30)),
  maxPostsPerCheck: Math.max(1, numberValue('MAX_POSTS_PER_CHECK', 20)),
  maxCandidatesPerCheck: Math.max(20, numberValue('MAX_CANDIDATES_PER_CHECK', 80)),
  maxPostsPerStore: Math.max(1, numberValue('MAX_POSTS_PER_STORE', 6)),
  maxPostsPerCategory: Math.max(1, numberValue('MAX_POSTS_PER_CATEGORY', 4)),
  minDiscountPercent: Math.max(1, numberValue('MIN_DISCOUNT_PERCENT', 1)),
  maxPrice: numberValue('MAX_PRICE', null),
  requireImageForPost: envFlag('REQUIRE_IMAGE_FOR_POST'),
  startupPostMode: enumValue('STARTUP_POST_MODE', ['off', 'check', 'refresh'], 'refresh'),

  sourceFlags,
  includeKeywords: stringList('INCLUDE_KEYWORDS', DISCOVERY_TERMS),
  excludeKeywords: stringList('EXCLUDE_KEYWORDS', EXCLUDE_KEYWORDS),
  monitoredCategories: stringList('MONITORED_CATEGORIES', MONITORED_CATEGORIES),
  monitoredStores: stringList('MONITORED_STORES', ['Kabum', 'Kalunga']),

  version: '1.3.5-test'
};
