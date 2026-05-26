import { config } from '../config.js';
import { state, getUptimeSeconds } from '../state.js';
import { getRecentDeals, getStats } from '../storage/jsonStore.js';
import { buildDealMessage } from '../discord/embeds.js';
import { runCheck } from '../scheduler.js';

export async function handleInteraction(interaction) {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'deals') {
    await handleDeals(interaction);
    return;
  }

  if (interaction.commandName === 'forcecheck') {
    await handleForceCheck(interaction);
    return;
  }

  if (interaction.commandName === 'status') {
    await handleStatus(interaction);
    return;
  }

  if (interaction.commandName === 'filters') {
    await handleFilters(interaction);
  }
}

async function handleDeals(interaction) {
  const limit = interaction.options.getInteger('limit') || 5;
  const deals = await getRecentDeals(Math.min(limit, 10));

  if (!deals.length) {
    await interaction.reply({
      content: 'No deals stored yet. Use /forcecheck first.'
    });
    return;
  }

  await interaction.reply({
    content: `Showing ${deals.length} recent gamer accessory deal(s):`
  });

  for (const deal of deals) {
    await interaction.followUp({
      ...buildDealMessage(deal)
    });
  }
}

async function handleForceCheck(interaction) {
  if (interaction.deferred || interaction.replied) {
    return;
  }

  await interaction.deferReply();

  const result = await runCheck({ post: true });

  await interaction.editReply({
    content: result.skipped
      ? 'Manual check skipped because another check was already running.'
      : `Manual check finished. Found: ${result.found}. Posted: ${result.posted}.`
  });
}

async function handleStatus(interaction) {
  const stats = await getStats();

  await interaction.reply({
    content: [
      '**Gamer Accessory Deals Bot Status**',
      `Uptime: ${getUptimeSeconds()} seconds`,
      `Last check: ${state.lastCheck || 'Never'}`,
      `Last error: ${state.lastError || 'None'}`,
      `Last run found: ${state.lastRunFound}`,
      `Last run posted: ${state.lastRunPosted}`,
      `Total deals found: ${state.totalDealsFound}`,
      `Total deals posted: ${state.totalDealsPosted}`,
      `Stored deals: ${stats.storedDeals}`,
      `Posted deals: ${stats.postedDeals}`,
      `Tracked products: ${stats.trackedProducts}`,
      `Monitored stores: ${config.monitoredStores.join(', ')}`,
      `Monitored categories: ${config.monitoredCategories.join(', ')}`,
      `Discord status: ${state.discordStatus}`,
      `Keep-alive server: running`,
      `Version: ${state.version}`
    ].join('\n')
  });
}

async function handleFilters(interaction) {
  await interaction.reply({
    content: [
      '**Current Filters**',
      `Check interval: ${config.checkIntervalMinutes} minutes`,
      `Max posts per check: ${config.maxPostsPerCheck}`,
      `Minimum percentage discount: ${config.minDiscountPercent}%`,
      `Maximum price: ${config.maxPrice === null ? 'Not set' : `R$ ${config.maxPrice}`}`,
      `Stores: ${config.monitoredStores.join(', ')}`,
      `Categories: ${config.monitoredCategories.join(', ')}`,
      `Include keywords: ${config.includeKeywords.join(', ')}`,
      `Exclude keywords: ${config.excludeKeywords.join(', ')}`
    ].join('\n')
  });
}
