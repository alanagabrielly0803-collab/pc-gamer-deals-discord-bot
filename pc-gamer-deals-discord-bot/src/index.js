import { client, loginDiscord } from './discord/client.js';
import { startKeepAliveServer } from './keepAlive.js';
import { startScheduler, runCheck } from './scheduler.js';

process.on('unhandledRejection', (error) => {
  console.error('[process] Unhandled rejection:', error);
});

process.on('uncaughtException', (error) => {
  console.error('[process] Uncaught exception:', error);
});

startKeepAliveServer(client);

await loginDiscord();

startScheduler();

setTimeout(() => {
  runCheck({ post: true });
}, 10_000);
