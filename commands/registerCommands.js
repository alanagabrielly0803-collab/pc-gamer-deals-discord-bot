import dotenv from 'dotenv';
import { REST, Routes, SlashCommandBuilder } from 'discord.js';

dotenv.config();

const token = process.env['DISCORD_TOKEN'];
const clientId = process.env['CLIENT_ID'];
const guildId = process.env['GUILD_ID'];

if (!token || !clientId || !guildId) {
  throw new Error('Discord command registration environment variables are required.');
}

const commands = [
  new SlashCommandBuilder()
    .setName('deals')
    .setDescription('Mostra ofertas recentes de informática.')
    .addIntegerOption((option) =>
      option
        .setName('limit')
        .setDescription('Número de ofertas para mostrar, máximo 10.')
        .setMinValue(1)
        .setMaxValue(10)
    ),

  new SlashCommandBuilder()
    .setName('forcecheck')
    .setDescription('Busca manualmente e publica novas ofertas.'),

  new SlashCommandBuilder()
    .setName('debugdeals')
    .setDescription('Roda uma busca sem postar e mostra o diagnóstico dos filtros.'),

  new SlashCommandBuilder()
    .setName('fontes')
    .setDescription('Mostra quais fontes de ofertas estão ligadas e os limites atuais.'),

  new SlashCommandBuilder()
    .setName('refreshdeals')
    .setDescription('Apaga posts antigos do bot no canal e republica as ofertas atuais.'),

  new SlashCommandBuilder()
    .setName('status')
    .setDescription('Mostra o status do bot.'),

  new SlashCommandBuilder()
    .setName('filters')
    .setDescription('Mostra os filtros atuais de ofertas.')
].map((command) => command.toJSON());

export async function registerCommands() {
  const rest = new REST({ version: '10' }).setToken(token);

  console.log('Registering guild slash commands...');

  await rest.put(Routes.applicationGuildCommands(clientId, guildId), {
    body: commands
  });

  console.log('Slash commands registered.');
}
