import { config } from '../config.js';
import { state, getUptimeSeconds } from '../state.js';
import { getRecentDeals, getStats } from '../storage/jsonStore.js';
import { buildDealMessage } from '../discord/embeds.js';
import { refreshDeals, runCheck } from '../scheduler.js';
import { getLastDealDiagnostics } from '../services/dealService.js';
import { MessageFlags, PermissionsBitField } from 'discord.js';

const inFlightInteractions = new Set();

async function withInteractionLock(interaction, handler) {
  if (!interaction?.id) return;
  if (inFlightInteractions.has(interaction.id)) return;
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

    if (interaction.commandName === 'debugdeals') {
      await handleDebugDeals(interaction);
      return;
    }

    if (interaction.commandName === 'fontes') {
      await handleSources(interaction);
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
    await interaction.reply({ content: 'Ainda não há ofertas salvas. Use /forcecheck primeiro.' });
    return;
  }

  await interaction.reply({ content: `Mostrando ${deals.length} oferta(s) recente(s) de informática:` });

  for (const deal of deals) {
    await interaction.followUp({ ...buildDealMessage(deal) });
  }
}

function formatDiagnostics(diagnostics) {
  const pageHealth = diagnostics.pageHealth
    ? `live=${diagnostics.pageHealth.live}, semImagem=${diagnostics.pageHealth.withoutImage}, derrubadas=${diagnostics.pageHealth.dropped}, falhaTemporariaMantida=${diagnostics.pageHealth.transientKept}`
    : 'Ainda sem dados';

  return [
    '**Diagnóstico da busca**',
    `Gerado em: ${diagnostics.generatedAt || 'Ainda não gerado'}`,
    `Brutas: ${diagnostics.raw}`,
    `Candidatas: ${diagnostics.candidates}`,
    `Únicas: ${diagnostics.unique}`,
    `Finais: ${diagnostics.finalCandidates}`,
    `Vivas: ${diagnostics.live}`,
    `Selecionadas: ${diagnostics.selected}`,
    `Por loja, bruto: ${diagnostics.rawByStore}`,
    `Por loja, selecionadas: ${diagnostics.selectedByStore}`,
    `Rejeitadas no filtro inicial: ${diagnostics.initialRejected}`,
    `Rejeitadas no filtro final: ${diagnostics.finalRejected}`,
    `Page-health: ${pageHealth}`
  ].join('\n');
}

async function handleDebugDeals(interaction) {
  await interaction.deferReply();
  const result = await runCheck({ post: false });
  const diagnostics = getLastDealDiagnostics();
  await interaction.editReply({
    content: [
      result.skipped
        ? 'A busca de diagnóstico foi ignorada porque já havia outra execução em andamento.'
        : `Busca de diagnóstico concluída sem postar. Encontradas: ${result.found}.`,
      '',
      formatDiagnostics(diagnostics)
    ].join('\n')
  });
}

async function handleForceCheck(interaction) {
  if (interaction.deferred || interaction.replied) return;

  try {
    await interaction.deferReply();
  } catch (error) {
    if (String(error?.message || '').includes('already been acknowledged')) return;
    throw error;
  }

  const result = await runCheck({ post: true });
  const diagnostics = getLastDealDiagnostics();
  await interaction.editReply({
    content: result.skipped
      ? 'A verificação manual foi ignorada porque já havia outra execução em andamento.'
      : [`Verificação manual concluída. Encontradas: ${result.found}. Publicadas: ${result.posted}.`, '', formatDiagnostics(diagnostics)].join('\n')
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
    if (String(error?.message || '').includes('already been acknowledged')) return;
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

async function handleSources(interaction) {
  const flags = config.sourceFlags || {};
  await interaction.reply({
    content: [
      '**Fontes e limites atuais**',
      `${flags.kabum !== false ? 'ON' : 'OFF'} Kabum`,
      `${flags.kalunga !== false ? 'ON' : 'OFF'} Kalunga`,
      `${flags.terabyte === true ? 'ON' : 'OFF'} Terabyte`,
      `${flags.mercadoLivre === true ? 'ON' : 'OFF'} Mercado Livre`,
      `${flags.publicShopee === true ? 'ON' : 'OFF'} Shopee pública`,
      `${flags.shopee === true ? 'ON' : 'OFF'} Shopee direta`,
      `Máximo por checagem: ${config.maxPostsPerCheck}`,
      `Máximo por loja: ${config.maxPostsPerStore}`,
      `Máximo por categoria: ${config.maxPostsPerCategory}`,
      `Candidatos analisados: ${config.maxCandidatesPerCheck}`,
      `Exigir imagem: ${config.requireImageForPost ? 'sim' : 'não'}`
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
