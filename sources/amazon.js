import { logger } from '../utils/logger.js';

export async function fetchAmazonDeals() {
  const hasCredentials =
    process.env.AMAZON_ACCESS_KEY &&
    process.env.AMAZON_SECRET_KEY &&
    process.env.AMAZON_PARTNER_TAG;

  if (!hasCredentials) {
    logger.info('Amazon skipped: Product Advertising API credentials are not configured.');
    return [];
  }

  logger.warn(
    'Amazon PA-API credentials detected, but this starter project intentionally avoids unsigned scraping. Implement PA-API request signing before enabling Amazon deals.'
  );

  return [];
}
