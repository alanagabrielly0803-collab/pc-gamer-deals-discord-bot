import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder
} from 'discord.js';

import { truncate } from '../utils/text.js';

const storeColors = {
  'Mercado Livre': 0xffe600,
  Kalunga: 0x00a8e8,
  Amazon: 0xff9900,
  Kabum: 0xff6500,
  Terabyte: 0x00a0df,
  Pichau: 0xe30613,
  'Magazine Luiza': 0x0086ff,
  AliExpress: 0xe62e04,
  Shopee: 0xee4d2d
};

function addField(fields, name, value, inline = true) {
  if (!value) return;

  fields.push({
    name,
    value: String(value).slice(0, 1024),
    inline
  });
}

function translateConfidence(value) {
  const map = {
    high: 'alta',
    medium: 'média',
    low: 'baixa'
  };

  return map[String(value || '').toLowerCase()] || String(value || '');
}

function translateReason(value) {
  const map = {
    missing_deal: 'oferta ausente',
    missing_product_name: 'nome do produto ausente',
    missing_product_url: 'link do produto ausente',
    missing_store_name: 'nome da loja ausente',
    forbidden_title_pattern: 'título bloqueado',
    forbidden_url_pattern: 'URL bloqueada',
    not_product_page: 'página não parece ser de produto',
    invalid_current_price: 'preço atual inválido',
    price_above_max: 'preço acima do máximo configurado',
    blocked_keyword: 'termo bloqueado',
    no_relevant_signal: 'sem sinal relevante',
    discount_below_threshold: 'desconto abaixo do mínimo',
    out_of_stock: 'sem estoque',
    matched_strong_category_and_signal: 'categoria forte e sinal relevante',
    matched_contextual_keyword_with_context: 'termo contextual com contexto',
    matched_category_signal: 'sinal de categoria',
    shopee_without_original_price: 'Shopee sem preço original',
    mercado_livre_without_original_price: 'Mercado Livre sem preço original'
  };

  return map[String(value || '').toLowerCase()] || String(value || '');
}

export function buildDealMessage(deal, options = {}) {
  const fields = [];

  addField(fields, 'Loja', deal.storeName);
  addField(fields, 'Categoria', deal.category);
  addField(fields, 'Preço atual', deal.currentPriceText);
  addField(fields, 'Preço original', deal.originalPriceText);
  addField(fields, 'Desconto', deal.discountPercent !== null ? `${deal.discountPercent}% OFF` : null);
  addField(fields, 'Cupom', deal.couponCode);
  addField(fields, 'Pagamento', deal.paymentDetails);
  addField(fields, 'Parcelamento', deal.installmentPrice);
  addField(fields, 'Estoque', deal.stockStatus);
  addField(fields, 'Frete', deal.shippingInfo);
  addField(
    fields,
    'Avaliação',
    deal.rating ? `${deal.rating}${deal.reviewCount ? ` (${deal.reviewCount} avaliações)` : ''}` : null
  );
  addField(fields, 'Fim da oferta', deal.dealEndsAt ? new Date(deal.dealEndsAt).toUTCString() : null);
  addField(fields, 'Tempo restante', deal.timeRemaining);
  addField(
    fields,
    'Confiança',
    deal.validationConfidence
      ? `${translateConfidence(deal.validationConfidence)} (${translateReason(deal.validationReason || 'não disponível')})`
      : null
  );
  addField(fields, 'Marca / Modelo', [deal.brand, deal.model].filter(Boolean).join(' / '));
  addField(fields, 'Especificações', deal.specs, false);
  addField(fields, 'Encontrado em', new Date(deal.foundAt).toLocaleString('pt-BR'), false);

  const title = deal.priceDropText
    ? `Queda de preço: ${deal.productName}`
    : deal.isBestPriceComparison
      ? `Menor preço encontrado: ${deal.productName}`
      : deal.isFlashSale
        ? `Oferta relâmpago: ${deal.productName}`
        : `Oferta de informática: ${deal.productName}`;

  const descriptionParts = [
    deal.priceDropText,
    deal.comparisonText,
    deal.description,
    deal.validationConfidence ? `Confiança da validação: ${translateConfidence(deal.validationConfidence)}.` : null,
    deal.discountPercent !== null ? `Desconto detectado: ${deal.discountPercent}% OFF.` : null
  ].filter(Boolean);

  const embed = new EmbedBuilder()
    .setTitle(truncate(title, 256))
    .setURL(deal.productUrl)
    .setColor(storeColors[deal.storeName] || 0x5865f2)
    .setDescription(truncate(descriptionParts.join('\n'), 900) || 'Uma oferta de informática foi encontrada.')
    .setFooter({ text: `Fonte: ${deal.source || deal.storeName}` })
    .setTimestamp(new Date());

  if (options.cardAttachmentName) {
    embed.setImage(`attachment://${options.cardAttachmentName}`);
  } else if (deal.imageUrl) {
    embed.setImage(deal.imageUrl);
  }

  if (fields.length > 0) {
    embed.addFields(fields.slice(0, 25));
  }

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setLabel('Ver oferta')
      .setStyle(ButtonStyle.Link)
      .setURL(deal.productUrl)
  );

  return {
    embeds: [embed],
    components: [row]
  };
}
