import { config } from '../config.js';
import { state, getUptimeSeconds } from '../state.js';
import { getRecentDeals, getStats } from '../storage/jsonStore.js';
import { buildDealMessage } from '../discord/embeds.js';
import { refreshDeals, runCheck } from '../scheduler.js';
import { getLastDealDiagnostics } from '../services/dealService.js';
import { MessageFlags, PermissionsBitField } from 'discord.js';

const inFlightInteractions = new Set();
const SAFE_DISCORD_CONTENT_LENGTH = 1900;

function limitText(value, maxLength = SAFE_DISCORD_CONTENT_LENGTH) {
  const text = String(value ?? '');
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 80)}\n\n...resposta cortada para não passar do limite do Discord.`;
}

function compactList(values, maxItems = 18) {
  const list = Array.isArray(values) ? values.filter(Boolean) : [];
  if (!list.length) return 'Nenhum';
  const visible = list.slice(0, maxItems).join(', ');
  const hidden = list.length - Math.min(list.length, maxItems);
  return hidden > 0 ? `${visible} ... (+${hidden} ocultos)` : visible;
}

async function replySafe(interaction, content, options = {}) {
  return interaction.reply({
    ...options,
    content: limitText(content)
  });
}

async function editReplySafe(interaction, content, options = {}) {
  return interaction.editReply({
    ...options,
    content: limitText(content)
  });
}

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
    await replySafe(interaction, 'Ainda não há ofertas salvas. Use /forcecheck primeiro.');
    return;
  }

  await replySafe(interaction, `Mostrando ${deals.length} oferta(s) recente(s) de informática:`);

  for (const deal of deals) {
    await interaction.followUp({ ...buildDealMessage(deal) });
  }
}

function formatDiagnostics(diagnostics) {
  const pageHealth = diagnostics.pageHealth
    ? `live=${diagnostics.pageHealth.live}, semImagem=${diagnostics.pageHealth.withoutImage}, derrubadas=${diagnostics.pageHealth.dropped}, falhaTemporariaMantida=${diagnostics.pageHealth.transientKept}`
    : 'Ainda sem dados';

  return limitText([
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
  ].join('\n'));
}

async function handleDebugDeals(interaction) {
  await interaction.deferReply();
  const result = await runCheck({ post: false });
  const diagnostics = getLastDealDiagnostics();
  await editReplySafe(
    interaction,
    [
      result.skipped
        ? 'A busca de diagnóstico foi ignorada porque já havia outra execução em andamento.'
        : `Busca de diagnóstico concluída sem postar. Encontradas: ${result.found}.`,
      '',
      formatDiagnostics(diagnostics)
    ].join('\n')
  );
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
  await editReplySafe(
    interaction,
    result.skipped
      ? 'A verificação manual foi ignorada porque já havia outra execução em andamento.'
      : [`Verificação manual concluída. Encontradas: ${result.found}. Publicadas: ${result.posted}.`, '', formatDiagnostics(diagnostics)].join('\n')
  );
}

async function handleRefreshDeals(interaction) {
  const perms = interaction.memberPermissions;
  const canModerate =
    perms?.has(PermissionsBitField.Flags.ManageMessages) ||
    perms?.has(PermissionsBitField.Flags.Administrator);

  if (!canModerate) {
    await replySafe(interaction, 'Você precisa de permissão de Gerenciar Mensagens ou Administrador para usar este comando.', {
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

  await editReplySafe(
    interaction,
    [
      `Limpeza concluída. ${result.deleted || 0} mensagem(ns) antiga(s) do bot excluída(s).`,
      result.skipped
        ? 'A republicação foi ignorada porque já havia outra verificação em andamento.'
        : `Republicação concluída. Encontradas: ${result.found}. Publicadas: ${result.posted}.`
    ].join(' ')
  );
}

async function handleStatus(interaction) {
  const stats = await getStats();

  await replySafe(
    interaction,
    [
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
      `Lojas monitoradas: ${compactList(config.monitoredStores, 12)}`,
      `Categorias monitoradas: ${compactList(config.monitoredCategories, 12)}`,
      `Status do Discord: ${state.discordStatus}`,
      `Servidor de keep-alive: em execução`,
      `Versão: ${state.version}`
    ].join('\n')
  );
}

async function handleSources(interaction) {
  const flags = config.sourceFlags || {};
  await replySafe(
    interaction,
    [
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
  );
}

async function handleFilters(interaction) {
  await replySafe(
    interaction,
    [
      '**Filtros Atuais**',
      `Intervalo de verificação: ${config.checkIntervalMinutes} minutos`,
      `Máximo de posts por verificação: ${config.maxPostsPerCheck}`,
      `Desconto mínimo: ${config.minDiscountPercent}%`,
      `Preço máximo: ${config.maxPrice === null ? 'Não definido' : `R$ ${config.maxPrice}`}`,
      `Lojas: ${compactList(config.monitoredStores, 12)}`,
      `Categorias: ${compactList(config.monitoredCategories, 12)}`,
      `Palavras-chave incluídas: ${compactList(config.includeKeywords, 20)}`,
      `Palavras-chave excluídas: ${compactList(config.excludeKeywords, 20)}`
    ].join('\n')
  );
}
