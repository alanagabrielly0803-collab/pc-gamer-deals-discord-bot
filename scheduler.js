import cron from 'node-cron';

import { config } from './config.js';
import { state } from './state.js';
import { findDeals } from './services/dealService.js';
import { postNewDeals, purgeBotPosts } from './discord/poster.js';

let isChecking = false;

async function executeCheck({ post = true } = {}) {
  console.log('[scheduler] Checking for gamer accessory deals...');

  const deals = await findDeals();
  const posted = post ? await postNewDeals(deals, config.maxPostsPerCheck) : 0;

  state.lastCheck = new Date().toISOString();
  state.lastRunFound = deals.length;
  state.lastRunPosted = posted;
  state.totalDealsFound += deals.length;
  state.totalDealsPosted += posted;
  state.lastError = null;

  console.log(`[scheduler] Check complete. Found=${deals.length}, Posted=${posted}`);

  return { found: deals.length, posted };
}

async function withCheckLock(task) {
  if (isChecking) {
    console.log('[scheduler] Check skipped because another check is already running.');
    return { found: 0, posted: 0, skipped: true };
  }

  isChecking = true;

  try {
    return await task();
  } catch (error) {
    state.lastError = error.message;
    console.error('[scheduler] Check failed:', error);
    return { found: 0, posted: 0, error: error.message };
  } finally {
    isChecking = false;
  }
}

export async function runCheck({ post = true } = {}) {
  return withCheckLock(() => executeCheck({ post }));
}

export async function refreshDeals() {
  return withCheckLock(async () => {
    console.log('[scheduler] Refreshing deals: cleaning old bot posts and reposting current offers...');

    const deleted = await purgeBotPosts();
    const result = await executeCheck({ post: true });

    return {
      deleted,
      ...result
    };
  });
}

export function startScheduler() {
  const minutes = Math.max(5, config.checkIntervalMinutes);
  const expression = `*/${minutes} * * * *`;

  cron.schedule(expression, () => {
    runCheck({ post: true });
  });

  console.log(`[scheduler] Scheduled checks every ${minutes} minute(s).`);
}
