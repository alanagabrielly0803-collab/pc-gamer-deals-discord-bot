import { logger } from '../utils/logger.js';

export async function fetchAliExpressDeals() {
  const hasCredentials = process.env.ALIEXPRESS_APP_KEY && process.env.ALIEXPRESS_SECRET;

  if (!hasCredentials) {
    logger.info('AliExpress skipped: affiliate API credentials are not configured.');
    return [];
  }

  logger.warn('AliExpress credentials detected, but affiliate API integration is not enabled in this starter.');
  return [];
}
