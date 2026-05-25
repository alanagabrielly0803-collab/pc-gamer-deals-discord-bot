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

// Executa a primeira checagem imediatamente após o bot iniciar
runCheck({ post: true }).catch((error) => {
  console.error('[startup] Initial check failed:', error);
});
