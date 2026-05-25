import { config } from '../config.js';
import { client } from './client.js';
import { buildDealMessage } from './embeds.js';
import { hasPosted, markPosted } from '../storage/jsonStore.js';

export async function getTargetChannel() {
  const channel = await client.channels.fetch(config.channelId);

  if (!channel || !channel.isTextBased()) {
    throw new Error('Configured CHANNEL_ID is not a text-based channel.');
  }

  return channel;
}

export async function postDeal(deal) {
  if (await hasPosted(deal)) {
    return {
      posted: false,
      reason: 'duplicate'
    };
  }

  const channel = await getTargetChannel();
  const message = await channel.send(buildDealMessage(deal));

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
