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
  TerabyteShop: 0x00a0df,
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

export function buildDealMessage(deal) {
  const fields = [];

  addField(fields, 'Store', deal.storeName);
  addField(fields, 'Category', deal.category);
  addField(fields, 'Current price', deal.currentPriceText);
  addField(fields, 'Original price', deal.originalPriceText);
  addField(fields, 'Discount', deal.discountPercent !== null ? `${deal.discountPercent}% OFF` : null);
  addField(fields, 'Coupon', deal.couponCode);
  addField(fields, 'Payment', deal.paymentDetails);
  addField(fields, 'Installments', deal.installmentPrice);
  addField(fields, 'Stock', deal.stockStatus);
  addField(fields, 'Shipping', deal.shippingInfo);
  addField(
    fields,
    'Rating',
    deal.rating ? `${deal.rating}${deal.reviewCount ? ` (${deal.reviewCount} reviews)` : ''}` : null
  );
  addField(fields, 'Deal ends', deal.dealEndsAt ? new Date(deal.dealEndsAt).toUTCString() : null);
  addField(fields, 'Time remaining', deal.timeRemaining);
  addField(fields, 'Brand / Model', [deal.brand, deal.model].filter(Boolean).join(' / '));
  addField(fields, 'Specs', deal.specs, false);
  addField(fields, 'Found at', new Date(deal.foundAt).toLocaleString('pt-BR'), false);

  const title = deal.priceDropText
    ? `Price drop: ${deal.productName}`
    : deal.isBestPriceComparison
      ? `Lowest price found: ${deal.productName}`
      : deal.isFlashSale
        ? `Flash deal: ${deal.productName}`
        : `Gamer accessory deal: ${deal.productName}`;

  const descriptionParts = [
    deal.priceDropText,
    deal.comparisonText,
    deal.description,
    deal.discountPercent !== null ? `Discount detected: ${deal.discountPercent}% OFF.` : null
  ].filter(Boolean);

  const embed = new EmbedBuilder()
    .setTitle(truncate(title, 256))
    .setURL(deal.productUrl)
    .setColor(storeColors[deal.storeName] || 0x5865f2)
    .setDescription(truncate(descriptionParts.join('\n'), 900) || 'A gamer accessory deal was found.')
    .setFooter({ text: `Source: ${deal.source || deal.storeName}` })
    .setTimestamp(new Date());

  if (deal.imageUrl) {
    embed.setImage(deal.imageUrl);
  }

  if (fields.length > 0) {
    embed.addFields(fields.slice(0, 25));
  }

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setLabel('View Deal')
      .setStyle(ButtonStyle.Link)
      .setURL(deal.productUrl)
  );

  return {
    embeds: [embed],
    components: [row]
  };
}
