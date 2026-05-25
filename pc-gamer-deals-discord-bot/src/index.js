import { client, loginDiscord } from './discord/client.js';
import { startKeepAliveServer } from './keepAlive.js';
import { startScheduler, runCheck } from './scheduler.js';
import { registerCommands } from './commands/registerCommands.js';

process.on('unhandledRejection', (error) => {
  console.error('[process] Unhandled rejection:', error);
});

process.on('uncaughtException', (error) => {
  console.error('[process] Uncaught exception:', error);
});

startKeepAliveServer(client);

await loginDiscord();
await registerCommands();

startScheduler();

runCheck({ post: true }).catch((error) => {
  console.error('[startup] Initial check failed:', error);
});
