import { config } from '../config.js';
import { state, getUptimeSeconds } from '../state.js';
import { getRecentDeals, getStats } from '../storage/jsonStore.js';
import { buildDealMessage } from '../discord/embeds.js';
import { refreshDeals, runCheck } from '../scheduler.js';
import { MessageFlags, PermissionsBitField } from 'discord.js';

const inFlightInteractions = new Set();

async function withInteractionLock(interaction, handler) {
  if (!interaction?.id) {
    return;
  }

  if (inFlightInteractions.has(interaction.id)) {
    return;
  }

  inFlightInteractions.add(interaction.id);

  try {
    await handler();
  } finally {
    inFlightInteractions.delete(interaction.id);
  }
}

export async function handleInteraction(interaction) {
  if (!interaction.isChatInputCommand()) return;

  await withInteractionLock(interaction, async () => {
    if (interaction.commandName === 'deals') {
      await handleDeals(interaction);
      return;
    }

    if (interaction.commandName === 'forcecheck') {
      await handleForceCheck(interaction);
      return;
    }

    if (interaction.commandName === 'refreshdeals') {
      await handleRefreshDeals(interaction);
      return;
    }

    if (interaction.commandName === 'status') {
      await handleStatus(interaction);
      return;
    }

    if (interaction.commandName === 'filters') {
      await handleFilters(interaction);
    }
  });
}

async function handleDeals(interaction) {
  const limit = interaction.options.getInteger('limit') || 5;
  const deals = await getRecentDeals(Math.min(limit, 10));

  if (!deals.length) {
    await interaction.reply({
      content: 'Ainda não há ofertas salvas. Use /forcecheck primeiro.'
    });
    return;
  }

  await interaction.reply({
    content: `Mostrando ${deals.length} oferta(s) recente(s) de informática:`
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

  try {
    await interaction.deferReply();
  } catch (error) {
    if (String(error?.message || '').includes('already been acknowledged')) {
      return;
    }
    throw error;
  }

  const result = await runCheck({ post: true });

    await interaction.editReply({
      content: result.skipped
        ? 'A verificação manual foi ignorada porque já havia outra execução em andamento.'
        : `Verificação manual concluída. Encontradas: ${result.found}. Publicadas: ${result.posted}.`
    });
}

async function handleRefreshDeals(interaction) {
  const perms = interaction.memberPermissions;
  const canModerate =
    perms?.has(PermissionsBitField.Flags.ManageMessages) ||
    perms?.has(PermissionsBitField.Flags.Administrator);

  if (!canModerate) {
    await interaction.reply({
      content: 'Você precisa de permissão de Gerenciar Mensagens ou Administrador para usar este comando.',
      flags: MessageFlags.Ephemeral
    });
    return;
  }

  try {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  } catch (error) {
    if (String(error?.message || '').includes('already been acknowledged')) {
      return;
    }
    throw error;
  }

  const result = await refreshDeals();

  await interaction.editReply({
    content: [
      `Limpeza concluída. ${result.deleted || 0} mensagem(ns) antiga(s) do bot excluída(s).`,
      result.skipped
        ? 'A republicação foi ignorada porque já havia outra verificação em andamento.'
        : `Republicação concluída. Encontradas: ${result.found}. Publicadas: ${result.posted}.`
    ].join(' ')
  });
}

async function handleStatus(interaction) {
  const stats = await getStats();

  await interaction.reply({
    content: [
      '**Status do Bot de Ofertas de Informática**',
      `Tempo de atividade: ${getUptimeSeconds()} segundos`,
      `Última verificação: ${state.lastCheck || 'Nunca'}`,
      `Último erro: ${state.lastError || 'Nenhum'}`,
      `Última execução encontrou: ${state.lastRunFound}`,
      `Última execução publicou: ${state.lastRunPosted}`,
      `Total de ofertas encontradas: ${state.totalDealsFound}`,
      `Total de ofertas publicadas: ${state.totalDealsPosted}`,
      `Ofertas armazenadas: ${stats.storedDeals}`,
      `Ofertas publicadas: ${stats.postedDeals}`,
      `Produtos acompanhados: ${stats.trackedProducts}`,
      `Lojas monitoradas: ${config.monitoredStores.join(', ')}`,
      `Categorias monitoradas: ${config.monitoredCategories.join(', ')}`,
      `Status do Discord: ${state.discordStatus}`,
      `Servidor de keep-alive: em execução`,
      `Versão: ${state.version}`
    ].join('\n')
  });
}

async function handleFilters(interaction) {
  await interaction.reply({
    content: [
      '**Filtros Atuais**',
      `Intervalo de verificação: ${config.checkIntervalMinutes} minutos`,
      `Máximo de posts por verificação: ${config.maxPostsPerCheck}`,
      `Desconto mínimo: ${config.minDiscountPercent}%`,
      `Preço máximo: ${config.maxPrice === null ? 'Não definido' : `R$ ${config.maxPrice}`}`,
      `Lojas: ${config.monitoredStores.join(', ')}`,
      `Categorias: ${config.monitoredCategories.join(', ')}`,
      `Palavras-chave incluídas: ${config.includeKeywords.join(', ')}`,
      `Palavras-chave excluídas: ${config.excludeKeywords.join(', ')}`
    ].join('\n')
  });
}
