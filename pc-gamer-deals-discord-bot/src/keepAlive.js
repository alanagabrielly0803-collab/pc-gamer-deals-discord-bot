import express from 'express';
import { config } from './config.js';
import { state, getUptimeSeconds } from './state.js';

export function startKeepAliveServer(client) {
  const app = express();

  app.get('/', (_req, res) => {
    res.type('text/plain').send('PC Gamer Deals Discord Bot is running.');
  });

  app.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      uptime: getUptimeSeconds(),
      lastCheck: state.lastCheck,
      totalDealsFound: state.totalDealsFound,
      totalDealsPosted: state.totalDealsPosted,
      monitoredStores: config.monitoredStores,
      monitoredCategories: config.monitoredCategories,
      discordStatus: client?.ws?.status ?? state.discordStatus,
      memoryUsage: process.memoryUsage(),
      version: state.version
    });
  });

  app.listen(config.port, () => {
    console.log(`[web] Express keep-alive server listening on port ${config.port}`);
  });
}
