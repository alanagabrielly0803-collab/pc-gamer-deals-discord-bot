import dotenv from 'dotenv';
import { REST, Routes, SlashCommandBuilder } from 'discord.js';

dotenv.config();

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.CLIENT_ID;
const guildId = process.env.GUILD_ID;

if (!token || !clientId || !guildId) {
  throw new Error('DISCORD_TOKEN, CLIENT_ID, and GUILD_ID are required.');
}

const commands = [
  new SlashCommandBuilder()
    .setName('deals')
    .setDescription('Show recent gamer accessory deals.')
    .addIntegerOption((option) =>
      option
        .setName('limit')
        .setDescription('Number of deals to show, maximum 10.')
        .setMinValue(1)
        .setMaxValue(10)
    ),

  new SlashCommandBuilder()
    .setName('forcecheck')
    .setDescription('Manually search and publicly post new deals.'),

  new SlashCommandBuilder()
    .setName('refreshdeals')
    .setDescription('Delete old bot posts in the deals channel and repost the latest deals.'),

  new SlashCommandBuilder()
    .setName('status')
    .setDescription('Show bot status.'),

  new SlashCommandBuilder()
    .setName('filters')
    .setDescription('Show current deal filters.')
].map((command) => command.toJSON());

export async function registerCommands() {
  const rest = new REST({ version: '10' }).setToken(token);

  console.log('Registering guild slash commands...');

  await rest.put(Routes.applicationGuildCommands(clientId, guildId), {
    body: commands
  });

  console.log('Slash commands registered.');
}
