import fs from 'fs/promises';
import path from 'path';

import { areSameDeal, areSameProduct } from '../utils/dedupe.js';
import { isLowerPrice } from '../utils/price.js';

const DATA_DIR = path.resolve('data');
const DB_FILE = path.join(DATA_DIR, 'deals.json');

const initialData = {
  posted: {},
  recentDeals: [],
  productPrices: {},
  priceHistory: [],
  meta: {
    lastCheck: null
  }
};

async function ensureDb() {
  await fs.mkdir(DATA_DIR, { recursive: true });

  try {
    await fs.access(DB_FILE);
  } catch {
    await fs.writeFile(DB_FILE, JSON.stringify(initialData, null, 2));
  }
}

export async function readDb() {
  await ensureDb();

  try {
    const raw = await fs.readFile(DB_FILE, 'utf8');
    const parsed = JSON.parse(raw);

    return {
      posted: parsed.posted || {},
      recentDeals: Array.isArray(parsed.recentDeals) ? parsed.recentDeals : [],
      productPrices: parsed.productPrices || {},
      priceHistory: Array.isArray(parsed.priceHistory) ? parsed.priceHistory : [],
      meta: parsed.meta || { lastCheck: null }
    };
  } catch {
    return structuredClone(initialData);
  }
}

export async function writeDb(data) {
  await ensureDb();
  await fs.writeFile(DB_FILE, JSON.stringify(data, null, 2));
}

export async function resetDb() {
  await writeDb(structuredClone(initialData));
}

export async function enrichWithPriceTracking(deals) {
  const db = await readDb();

  return deals.map((deal) => {
    const previous = db.productPrices[deal.productKey];

    if (previous && isLowerPrice(deal.currentPrice, previous.currentPrice)) {
      return {
        ...deal,
        priceDropText: `📉 Price dropped from ${previous.currentPriceText} to ${deal.currentPriceText}`
      };
    }

    return deal;
  });
}

export async function saveSeenDeals(deals) {
  const db = await readDb();

  for (const deal of deals) {
    const existing = db.recentDeals.find((item) => areSameDeal(item, deal));

    if (!existing) {
      db.recentDeals.unshift({
        ...deal,
        messageId: null,
        seenAt: new Date().toISOString()
      });
    }

    const lastPrice = db.productPrices[deal.productKey];

    if (!lastPrice || isLowerPrice(deal.currentPrice, lastPrice.currentPrice)) {
      db.productPrices[deal.productKey] = {
        productName: deal.productName,
        storeName: deal.storeName,
        productUrl: deal.productUrl,
        currentPrice: deal.currentPrice,
        currentPriceText: deal.currentPriceText,
        updatedAt: new Date().toISOString()
      };
    }

    db.priceHistory.unshift({
      productKey: deal.productKey,
      productName: deal.productName,
      storeName: deal.storeName,
      currentPrice: deal.currentPrice,
      currentPriceText: deal.currentPriceText,
      foundAt: deal.foundAt
    });
  }

  db.recentDeals = db.recentDeals.slice(0, 500);
  db.priceHistory = db.priceHistory.slice(0, 1000);

  await writeDb(db);
}

export async function hasPosted(deal) {
  const db = await readDb();

  if (db.posted[deal.uniqueKey]?.messageId) return true;
  if (deal.urlKey && db.posted[deal.urlKey]?.messageId) return true;
  if (deal.dealKey && db.posted[deal.dealKey]?.messageId) return true;

  const postedRecords = Object.values(db.posted).filter((item) => item?.messageId);

  return postedRecords.some((record) => areSameDeal(record, deal));
}

export async function markPosted(deal, messageId) {
  if (!messageId) throw new Error('markPosted requires a Discord messageId.');

  const db = await readDb();

  const record = {
    productName: deal.productName,
    storeName: deal.storeName,
    currentPrice: deal.currentPrice,
    currentPriceText: deal.currentPriceText,
    productUrl: deal.productUrl,
    canonicalUrl: deal.canonicalUrl,
    productKey: deal.productKey,
    dealKey: deal.dealKey,
    urlKey: deal.urlKey,
    messageId,
    postedAt: new Date().toISOString()
  };

  db.posted[deal.uniqueKey] = record;
  if (deal.urlKey) db.posted[deal.urlKey] = record;
  if (deal.dealKey) db.posted[deal.dealKey] = record;

  const existing = db.recentDeals.find((item) => areSameDeal(item, deal));

  if (!existing) {
    db.recentDeals.unshift({
      ...deal,
      messageId,
      postedAt: new Date().toISOString()
    });
  } else {
    existing.messageId = messageId;
    existing.postedAt = new Date().toISOString();
  }

  db.recentDeals = db.recentDeals.slice(0, 500);
  await writeDb(db);
}

export async function getRecentDeals(limit = 10) {
  const db = await readDb();
  return db.recentDeals.slice(0, limit);
}

export async function getStats() {
  const db = await readDb();

  return {
    storedDeals: db.recentDeals.length,
    postedDeals: db.recentDeals.filter((deal) => deal.messageId).length,
    postedKeys: Object.values(db.posted).filter((record) => record?.messageId).length,
    trackedProducts: Object.keys(db.productPrices).length
  };
}
