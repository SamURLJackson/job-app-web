/**
 * PHASE 1: SOURCING
 * Generic job sourcing from RSS feeds, Adzuna API, and Apify scrapers.
 * Works for any field — not IT specific.
 */

import RSSParser from 'rss-parser';
import { logger } from './logger.js';

const parser = new RSSParser();

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getTitles() {
  return (process.env.JOB_TITLES ?? '').split(',').map(t => t.trim()).filter(Boolean);
}

function normalizeJob(overrides) {
  return {
    title: '',
    company: '',
    url: '',
    description: '',
    salary: null,
    isEmailApply: false,
    applyEmail: null,
    ...overrides,
  };
}

// ─── RSS Feeds ────────────────────────────────────────────────────────────────

const RSS_FEEDS = [
  // Remote-focused (all fields)
  { url: 'https://weworkremotely.com/remote-jobs.rss',                                    source: 'WeWorkRemotely' },
  { url: 'https://remotive.com/remote-jobs/feed',                                         source: 'Remotive' },
  { url: 'https://remote.co/job-category/all-remote-jobs/feed/',                          source: 'Remote.co' },
  { url: 'https://jobspresso.co/remote-jobs/feed/',                                       source: 'Jobspresso' },
  { url: 'https://www.flexjobs.com/rss/newjobs.rss',                                      source: 'FlexJobs' },
  // Tech/IT (keep for IT users)
  { url: 'https://weworkremotely.com/categories/remote-devops-sysadmin-jobs.rss',         source: 'WeWorkRemotely' },
  { url: 'https://weworkremotely.com/categories/remote-full-stack-programming-jobs.rss',  source: 'WeWorkRemotely' },
];

async function fetchRSSFeeds() {
  const jobs = [];
  for (const feed of RSS_FEEDS) {
    try {
      const parsed = await parser.parseURL(feed.url);
      for (const item of parsed.items) {
        jobs.push(normalizeJob({
          title:       item.title ?? '',
          company:     item.author ?? item.creator ?? '',
          url:         item.link ?? '',
          description: item.content ?? item.contentSnippet ?? '',
          source:      feed.source,
        }));
      }
      logger.info(`[Phase 1] RSS ${feed.source}: ${parsed.items.length} jobs`);
    } catch (err) {
      logger.error(`[Phase 1] RSS feed failed (${feed.url}): ${err.message}`);
    }
  }
  return jobs;
}

// ─── Adzuna API ───────────────────────────────────────────────────────────────
// Free tier: 1,000 calls/month. Sign up at developer.adzuna.com
// Aggregates Indeed, LinkedIn, and many other boards — no scraping risk.

async function fetchAdzuna() {
  const appId  = process.env.ADZUNA_APP_ID;
  const appKey = process.env.ADZUNA_APP_KEY;
  if (!appId || !appKey) {
    logger.warn('[Phase 1] Adzuna credentials not set — skipping');
    return [];
  }

  const titles = getTitles();
  if (titles.length === 0) return [];

  const jobs = [];
  for (const title of titles) {
    try {
      const query = encodeURIComponent(title);
      const url = `https://api.adzuna.com/v1/api/jobs/us/search/1?app_id=${appId}&app_key=${appKey}&results_per_page=25&what=${query}&where=remote&content-type=application/json`;
      const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      for (const item of (data.results ?? [])) {
        jobs.push(normalizeJob({
          title:       item.title ?? '',
          company:     item.company?.display_name ?? '',
          url:         item.redirect_url ?? '',
          description: item.description ?? '',
          salary:      item.salary_min ? `$${item.salary_min}–$${item.salary_max}` : null,
          source:      'Adzuna',
        }));
      }
      logger.info(`[Phase 1] Adzuna "${title}": ${data.results?.length ?? 0} jobs`);
    } catch (err) {
      logger.error(`[Phase 1] Adzuna failed for "${title}": ${err.message}`);
    }
  }
  return jobs;
}

// ─── Apify Scrapers ───────────────────────────────────────────────────────────

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

async function fetchLinkedIn() {
  const rawJobs = [];
  for (const title of getTitles()) {
    const items = await runApifyActor(process.env.APIFY_LINKEDIN_ACTOR_ID, {
      queries: [title], locationQuery: 'United States', workType: 'Remote', count: 25,
    });
    rawJobs.push(...items);
  }
  return rawJobs.map(item => normalizeJob({
    title:       item.title ?? '',
    company:     item.companyName ?? '',
    url:         item.jobUrl ?? item.url ?? '',
    description: item.descriptionHtml ?? item.description ?? '',
    salary:      item.salary ?? null,
    source:      'LinkedIn',
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
  return rawJobs.map(item => normalizeJob({
    title:       item.positionName ?? item.title ?? '',
    company:     item.company ?? '',
    url:         item.url ?? '',
    description: item.description ?? '',
    salary:      item.salary ?? null,
    source:      'Indeed',
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
  return rawJobs.map(item => normalizeJob({
    title:       item.title ?? '',
    company:     item.company ?? '',
    url:         item.applyUrl ?? item.jobUrl ?? '',
    description: item.description ?? '',
    salary:      item.salary ?? null,
    source:      'Dice',
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
  return rawJobs.map(item => normalizeJob({
    title:       item.title ?? '',
    company:     item.company ?? '',
    url:         item.url ?? '',
    description: item.description ?? '',
    salary:      item.salary ?? null,
    source:      'BuiltIn',
  }));
}

// ─── Main Export ──────────────────────────────────────────────────────────────

export async function fetchAllJobs() {
  logger.info('[Phase 1] Starting job ingestion...');

  const [rss, adzuna, linkedin, indeed, dice, builtIn] = await Promise.allSettled([
    fetchRSSFeeds(),
    fetchAdzuna(),
    fetchLinkedIn(),
    fetchIndeed(),
    fetchDice(),
    fetchBuiltIn(),
  ]);

  const allJobs = [
    ...(rss.status      === 'fulfilled' ? rss.value      : []),
    ...(adzuna.status   === 'fulfilled' ? adzuna.value   : []),
    ...(linkedin.status === 'fulfilled' ? linkedin.value : []),
    ...(indeed.status   === 'fulfilled' ? indeed.value   : []),
    ...(dice.status     === 'fulfilled' ? dice.value     : []),
    ...(builtIn.status  === 'fulfilled' ? builtIn.value  : []),
  ].filter(job => job.url);

  logger.info(`[Phase 1] Total raw jobs ingested: ${allJobs.length}`);
  return allJobs;
}
