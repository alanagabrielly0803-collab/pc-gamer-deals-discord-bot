import { config } from './config.js';

export const state = {
  startedAt: Date.now(),
  lastCheck: null,
  lastError: null,

  totalDealsFound: 0,
  totalDealsPosted: 0,
  lastRunFound: 0,
  lastRunPosted: 0,

  discordStatus: 'starting',
  serviceStatus: 'running',
  experimentalScrapingEnabled: config.enableExperimentalScraping,
  version: config.version
};

export function getUptimeSeconds() {
  return Math.floor((Date.now() - state.startedAt) / 1000);
}
