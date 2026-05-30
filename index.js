import { config } from './config.js';
import { client, loginDiscord } from './discord/client.js';
import { startKeepAliveServer } from './keepAlive.js';
import { startScheduler, runCheck, refreshDeals } from './scheduler.js';

process.on('unhandledRejection', (error) => {
  console.error('[process] Unhandled rejection:', error);
});

process.on('uncaughtException', (error) => {
  console.error('[process] Uncaught exception:', error);
});

startKeepAliveServer(client);

if (config.discordEnabled) {
  await loginDiscord();
  const { registerCommands } = await import('./commands/registerCommands.js');
  await registerCommands();
} else {
  console.log('[startup] Discord disabled; running in test mode without login/command registration.');
}

startScheduler();

if (config.startupPostMode === 'refresh' && config.discordEnabled) {
  refreshDeals().catch((error) => {
    console.error('[startup] Initial refresh failed:', error);
  });
} else if (config.startupPostMode === 'check') {
  runCheck({ post: config.discordEnabled }).catch((error) => {
    console.error('[startup] Initial check failed:', error);
  });
} else {
  console.log('[startup] Startup posting disabled. Waiting for scheduler or slash command.');
}
