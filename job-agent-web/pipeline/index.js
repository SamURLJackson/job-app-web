/**
 * JOB AGENT PIPELINE — GitHub Actions Entry Point
 *
 * Runs the full pipeline and POSTs results back to the Vercel callback URL.
 * All config comes from environment variables injected by GitHub Actions.
 */

import 'dotenv/config';
import { fetchAllJobs }      from './phase1-sourcing.js';
import { evaluateJobs }      from './phase2-evaluation.js';
import { executeApplications } from './phase3-execution.js';
import { filterUnseen, markSeen } from './deduplication.js';
import { logger } from './logger.js';

const CALLBACK_URL     = process.env.CALLBACK_URL;
const WEBHOOK_SECRET   = process.env.WEBHOOK_SECRET;
const RUN_ID           = process.env.RUN_ID;
const USER_ID          = process.env.USER_ID;

async function postCallback(event, data) {
  if (!CALLBACK_URL) {
    logger.warn('[Main] No CALLBACK_URL set — skipping callback');
    return;
  }
  try {
    const res = await fetch(CALLBACK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-webhook-secret': WEBHOOK_SECRET ?? '',
      },
      body: JSON.stringify({ run_id: RUN_ID, user_id: USER_ID, event, data }),
    });
    if (!res.ok) logger.warn(`[Main] Callback ${event} returned ${res.status}`);
  } catch (err) {
    logger.error(`[Main] Callback failed: ${err.message}`);
  }
}

async function runPipeline() {
  logger.info('═══════════════════════════════════════');
  logger.info('  JOB AGENT PIPELINE STARTING');
  logger.info(`  Run ID: ${RUN_ID}`);
  logger.info(`  User ID: ${USER_ID}`);
  logger.info('═══════════════════════════════════════');

  try {
    // Phase 1
    const allJobs = await fetchAllJobs();

    // Deduplication
    const { fresh, seen } = await filterUnseen(allJobs);
    logger.info(`[Main] ${fresh.length} new jobs after deduplication`);

    if (fresh.length === 0) {
      logger.info('[Main] Nothing new. Pipeline complete.');
      await postCallback('complete', { jobs_fetched: 0, jobs_qualified: 0, emails_sent: 0, queued_count: 0 });
      return;
    }

    // Phase 2
    const qualified = await evaluateJobs(fresh);
    await markSeen(fresh, seen);

    if (qualified.length === 0) {
      logger.info('[Main] No jobs passed threshold. Pipeline complete.');
      await postCallback('complete', { jobs_fetched: allJobs.length, jobs_qualified: 0, emails_sent: 0, queued_count: 0 });
      return;
    }

    // Post qualified jobs batch to Vercel (saves to Supabase)
    await postCallback('jobs_batch', { jobs: qualified });

    // Phase 3
    const result = await executeApplications(qualified);

    await postCallback('complete', {
      jobs_fetched:   allJobs.length,
      jobs_qualified: qualified.length,
      emails_sent:    result.emailed,
      queued_count:   result.queued,
    });

    logger.info('═══════════════════════════════════════');
    logger.info('  PIPELINE COMPLETE');
    logger.info(`  Emails sent: ${result.emailed}`);
    logger.info(`  Queue added: ${result.queued}`);
    logger.info('═══════════════════════════════════════');

  } catch (err) {
    logger.error(`[Main] Pipeline failed: ${err.message}`);
    logger.error(err.stack);
    await postCallback('failed', { error: err.message });
    process.exit(1);
  }
}

runPipeline();
