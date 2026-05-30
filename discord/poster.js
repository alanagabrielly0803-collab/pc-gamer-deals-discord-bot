import { AttachmentBuilder } from 'discord.js';

import { config } from '../config.js';
import { client } from './client.js';
import { buildDealMessage } from './embeds.js';
import { hasPosted, markPosted, resetDb } from '../storage/jsonStore.js';
import { generateDealCard } from '../services/cardGenerator.js';

export async function getTargetChannel() {
  const channel = await client.channels.fetch(config.channelId);

  if (!channel || !channel.isTextBased()) {
    throw new Error('Configured CHANNEL_ID is not a text-based channel.');
  }

  return channel;
}

async function buildDiscordPayload(deal) {
  const cardAttachmentName = 'oferta.png';

  try {
    const cardBuffer = await generateDealCard(deal);
    const attachment = new AttachmentBuilder(cardBuffer, { name: cardAttachmentName });

    return {
      ...buildDealMessage(deal, { cardAttachmentName }),
      files: [attachment]
    };
  } catch (error) {
    console.warn('[discord] Failed to generate deal card, falling back to regular embed:', error.message);
    return buildDealMessage(deal);
  }
}

export async function postDeal(deal) {
  if (await hasPosted(deal)) {
    return {
      posted: false,
      reason: 'duplicate'
    };
  }

  const channel = await getTargetChannel();
  const payload = await buildDiscordPayload(deal);
  const message = await channel.send(payload);

  await markPosted(deal, message.id);

  return {
    posted: true,
    messageId: message.id
  };
}

export async function postNewDeals(deals, limit = config.maxPostsPerCheck) {
  let posted = 0;

  for (const deal of deals) {
    if (posted >= limit) break;

    const result = await postDeal(deal);

    if (result.posted) {
      posted += 1;
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
  }

  return posted;
}

export async function purgeBotPosts() {
  const channel = await getTargetChannel();
  const botUserId = client.user?.id;

  if (!botUserId) {
    throw new Error('Discord client is not ready.');
  }

  let before;
  let deleted = 0;

  for (;;) {
    const messages = await channel.messages.fetch({ limit: 100, before });
    if (!messages.size) break;

    for (const message of messages.values()) {
      if (message.author?.id !== botUserId) continue;

      try {
        await message.delete();
        deleted += 1;
      } catch (error) {
        console.warn('[discord] Failed to delete old bot message:', error.message);
      }
    }

    before = messages.last()?.id;
    if (!before || messages.size < 100) break;
  }

  await resetDb();

  return deleted;
}
