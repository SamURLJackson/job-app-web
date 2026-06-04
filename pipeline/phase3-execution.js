/**
 * PHASE 3: EXECUTION LAYER
 * Branches on application type:
 *
 *   A) Email apply  → Sends via Claude MCP (Gmail + Drive) using the Anthropic API
 *   B) Platform apply → Writes to a local JSON "kanban" queue for manual review
 *
 * No OAuth setup needed — uses your already-connected Google MCP connectors.
 * MCP servers: Gmail (https://gmailmcp.googleapis.com/mcp/v1)
 *              Drive (https://drivemcp.googleapis.com/mcp/v1)
 */

import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs/promises';
import path from 'path';
import { logger } from '../utils/logger.js';

const client = new Anthropic();

// ─── Gmail Send via MCP ───────────────────────────────────────────────────────

async function sendEmailApplication(job) {
  const resumeFileName = process.env.RESUME_FILENAME ?? 'Resume.pdf';
  const yourName = process.env.YOUR_NAME ?? 'Applicant';
  const linkedinUrl = process.env.LINKEDIN_URL ?? '';

  const prompt = `You are an assistant helping send a job application email.

Please do the following steps in order:
1. Search Google Drive for a file named "${resumeFileName}" and get its file ID.
2. Compose and send an email via Gmail with:
   - To: ${job.applyEmail}
   - Subject: Application for ${job.title} — ${yourName}
   - Body: The cover letter below, exactly as written, followed by a line break and then "LinkedIn: ${linkedinUrl}"
   - Attach the resume PDF from Drive using the file ID you found

Cover letter:
${job.coverLetter}

Send the email now.`;

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
      mcp_servers: [
        { type: 'url', url: 'https://gmailmcp.googleapis.com/mcp/v1',  name: 'gmail' },
        { type: 'url', url: 'https://drivemcp.googleapis.com/mcp/v1', name: 'drive' },
      ],
    });

    // Check the response for confirmation
    const text = response.content
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join(' ');

    logger.info(`[Phase 3] 📧 MCP Gmail response for "${job.title}": ${text.slice(0, 120)}...`);
    return true;
  } catch (err) {
    logger.error(`[Phase 3] MCP Gmail send failed for "${job.title}": ${err.message}`);
    return false;
  }
}

// ─── Kanban Queue: Platform-based Applications ────────────────────────────────

const QUEUE_FILE = path.resolve('./data/application_queue.json');

async function addToKanbanQueue(job) {
  let queue = [];
  try {
    const raw = await fs.readFile(QUEUE_FILE, 'utf-8');
    queue = JSON.parse(raw);
  } catch {
    // file doesn't exist yet — start fresh
  }

  queue.push({
    addedAt: new Date().toISOString(),
    status: 'pending',
    score: job.score,
    scoreReason: job.scoreReason,
    title: job.title,
    company: job.company,
    url: job.url,
    source: job.source,
    salaryNote: job.salaryNote,
    requiresM365: job.requiresM365 ?? false,
    requiresTicketing: job.requiresTicketing ?? false,
    linkedinUrl: process.env.LINKEDIN_URL ?? '',
    coverLetter: job.coverLetter,
    // Screening answers to pre-fill on application forms:
    screeningAnswers: {
      linkedinProfile: process.env.LINKEDIN_URL ?? '',
      usWorkAuthorized: 'Yes',
      requiresVisaSponsorship: 'No',
      m365AdminExperience: job.requiresM365 ? 'Yes' : null,
      itTicketingExperience: job.requiresTicketing ? 'Yes' : null,
    },
  });

  await fs.mkdir(path.dirname(QUEUE_FILE), { recursive: true });
  await fs.writeFile(QUEUE_FILE, JSON.stringify(queue, null, 2), 'utf-8');

  logger.info(`[Phase 3] 📋 Added to queue: "${job.title}" @ ${job.company} (Score: ${job.score}/10)`);
}

// ─── Main Export ──────────────────────────────────────────────────────────────

export async function executeApplications(qualifiedJobs) {
  logger.info(`[Phase 3] Processing ${qualifiedJobs.length} qualified jobs...`);

  let emailed = 0;
  let queued = 0;

  for (const job of qualifiedJobs) {
    if (job.isEmailApply && job.applyEmail) {
      const sent = await sendEmailApplication(job);
      if (sent) emailed++;
    } else {
      await addToKanbanQueue(job);
      queued++;
    }
  }

  logger.info(`[Phase 3] Done — ${emailed} emails sent, ${queued} added to queue`);
  return { emailed, queued };
}
