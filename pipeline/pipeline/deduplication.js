/**
 * Simple file-based deduplication store.
 * Tracks job URLs we've already processed so we don't re-score or re-apply.
 */

import fs from 'fs/promises';
import path from 'path';

const SEEN_FILE = path.resolve('./data/seen_jobs.json');

async function loadSeen() {
  try {
    const raw = await fs.readFile(SEEN_FILE, 'utf-8');
    return new Set(JSON.parse(raw));
  } catch {
    return new Set();
  }
}

async function saveSeen(seen) {
  await fs.mkdir(path.dirname(SEEN_FILE), { recursive: true });
  await fs.writeFile(SEEN_FILE, JSON.stringify([...seen]), 'utf-8');
}

export async function filterUnseen(jobs) {
  const seen = await loadSeen();
  const fresh = jobs.filter((job) => !seen.has(job.url));
  return { fresh, seen };
}

export async function markSeen(jobs, seen) {
  for (const job of jobs) seen.add(job.url);
  await saveSeen(seen);
}
