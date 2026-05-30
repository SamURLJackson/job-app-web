/**
 * PHASE 1: SOURCING
 * Identical logic to the original, but reads JOB_TITLES from env
 * which is injected per-user by GitHub Actions workflow inputs.
 */

import RSSParser from 'rss-parser';
import { logger } from './logger.js';

const parser = new RSSParser();

const WWR_FEEDS = [
  'https://weworkremotely.com/remote-jobs.rss',
  'https://weworkremotely.com/categories/remote-devops-sysadmin-jobs.rss',
];

async function fetchWWR() {
  const jobs = [];
  for (const feedUrl of WWR_FEEDS) {
    try {
      const feed = await parser.parseURL(feedUrl);
      for (const item of feed.items) {
        jobs.push({
          title: item.title ?? '',
          company: item.author ?? '',
          url: item.link ?? '',
          description: item.content ?? item.contentSnippet ?? '',
          salary: null,
          source: 'WeWorkRemotely',
          isEmailApply: false,
          applyEmail: null,
        });
      }
      logger.info(`[Phase 1] WWR: pulled ${feed.items.length} jobs from ${feedUrl}`);
    } catch (err) {
      logger.error(`[Phase 1] WWR feed failed (${feedUrl}): ${err.message}`);
    }
  }
  return jobs;
}

async function runApifyActor(actorId, input) {
  const token = process.env.APIFY_API_TOKEN;
  if (!token) { logger.warn('[Phase 1] APIFY_API_TOKEN not set'); return []; }
  if (!actorId) { logger.warn('[Phase 1] Actor ID not set'); return []; }

  const runUrl = `https://api.apify.com/v2/acts/${actorId}/run-sync-get-dataset-items?token=${token}`;
  try {
    const res = await fetch(runUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
      signal: AbortSignal.timeout(5 * 60 * 1000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
    return await res.json();
  } catch (err) {
    logger.error(`[Phase 1] Apify actor ${actorId} failed: ${err.message}`);
    return [];
  }
}

// Each fetcher reads JOB_TITLES from env (per-user, injected by workflow)
function getTitles() {
  return (process.env.JOB_TITLES ?? 'IT Manager').split(',').map(t => t.trim()).filter(Boolean);
}

async function fetchLinkedIn() {
  const rawJobs = [];
  for (const title of getTitles()) {
    const items = await runApifyActor(process.env.APIFY_LINKEDIN_ACTOR_ID, {
      queries: [title], locationQuery: 'United States', workType: 'Remote', count: 25,
    });
    rawJobs.push(...items);
  }
  return rawJobs.map(item => ({
    title: item.title ?? '', company: item.companyName ?? '',
    url: item.jobUrl ?? item.url ?? '',
    description: item.descriptionHtml ?? item.description ?? '',
    salary: item.salary ?? null, source: 'LinkedIn', isEmailApply: false, applyEmail: null,
  }));
}

async function fetchIndeed() {
  const rawJobs = [];
  for (const title of getTitles()) {
    const items = await runApifyActor(process.env.APIFY_INDEED_ACTOR_ID, {
      position: title, country: 'us', location: 'Remote', maxItems: 25,
    });
    rawJobs.push(...items);
  }
  return rawJobs.map(item => ({
    title: item.positionName ?? item.title ?? '', company: item.company ?? '',
    url: item.url ?? '', description: item.description ?? '',
    salary: item.salary ?? null, source: 'Indeed', isEmailApply: false, applyEmail: null,
  }));
}

async function fetchDice() {
  const rawJobs = [];
  for (const title of getTitles()) {
    const items = await runApifyActor(process.env.APIFY_DICE_ACTOR_ID, {
      keyword: title, location: 'Remote', maxResults: 25,
    });
    rawJobs.push(...items);
  }
  return rawJobs.map(item => ({
    title: item.title ?? '', company: item.company ?? '',
    url: item.applyUrl ?? item.jobUrl ?? '', description: item.description ?? '',
    salary: item.salary ?? null, source: 'Dice', isEmailApply: false, applyEmail: null,
  }));
}

async function fetchBuiltIn() {
  const rawJobs = [];
  for (const title of getTitles()) {
    const items = await runApifyActor(process.env.APIFY_BUILTIN_ACTOR_ID, {
      searchKeyword: title, remote: true, maxResults: 25,
    });
    rawJobs.push(...items);
  }
  return rawJobs.map(item => ({
    title: item.title ?? '', company: item.company ?? '',
    url: item.url ?? '', description: item.description ?? '',
    salary: item.salary ?? null, source: 'BuiltIn', isEmailApply: false, applyEmail: null,
  }));
}

export async function fetchAllJobs() {
  logger.info('[Phase 1] Starting job ingestion...');
  const [wwr, linkedin, indeed, dice, builtIn] = await Promise.allSettled([
    fetchWWR(), fetchLinkedIn(), fetchIndeed(), fetchDice(), fetchBuiltIn(),
  ]);
  const allJobs = [
    ...(wwr.status       === 'fulfilled' ? wwr.value       : []),
    ...(linkedin.status  === 'fulfilled' ? linkedin.value  : []),
    ...(indeed.status    === 'fulfilled' ? indeed.value    : []),
    ...(dice.status      === 'fulfilled' ? dice.value      : []),
    ...(builtIn.status   === 'fulfilled' ? builtIn.value   : []),
  ].filter(job => job.url);
  logger.info(`[Phase 1] Total raw jobs ingested: ${allJobs.length}`);
  return allJobs;
}
