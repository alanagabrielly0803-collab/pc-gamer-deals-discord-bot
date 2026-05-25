import { logger } from '../utils/logger.js';

export async function fetchShopeeDeals() {
  const hasCredentials = process.env.SHOPEE_APP_ID && process.env.SHOPEE_SECRET;

  if (!hasCredentials) {
    logger.info('Shopee skipped: affiliate/open API credentials are not configured.');
    return [];
  }

  logger.warn('Shopee credentials detected, but signed affiliate API integration is not enabled in this starter.');
  return [];
}
