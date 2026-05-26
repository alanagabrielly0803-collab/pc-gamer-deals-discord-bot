import { Client, GatewayIntentBits, Events } from 'discord.js';

import { config } from '../config.js';
import { state } from '../state.js';
import { handleInteraction } from '../commands/handlers.js';

export const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

client.once('clientReady', (readyClient) => {
  state.discordStatus = 'ready';
  console.log(`[discord] Logged in as ${readyClient.user.tag}`);
});

client.on(Events.ShardDisconnect, () => {
  state.discordStatus = 'disconnected';
  console.warn('[discord] Shard disconnected');
});

client.on(Events.ShardReconnecting, () => {
  state.discordStatus = 'reconnecting';
  console.warn('[discord] Shard reconnecting');
});

client.on(Events.Error, (error) => {
  state.discordStatus = 'error';
  console.error('[discord] Client error:', error.message);
});

client.on(Events.InteractionCreate, handleInteraction);

export async function loginDiscord() {
  await client.login(config.discordToken);
}
