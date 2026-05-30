/**
 * PHASE 3: EXECUTION
 * Email-apply jobs → send via Gmail MCP
 * Platform-apply jobs → already saved to Supabase via callback in index.js
 */

import Anthropic from '@anthropic-ai/sdk';
import { logger } from './logger.js';

const client = new Anthropic();

async function sendEmailApplication(job) {
  const resumeFileName = process.env.RESUME_FILENAME ?? 'resume.pdf';
  const yourName = process.env.YOUR_NAME ?? 'Applicant';

  const prompt = `You are an assistant helping send a job application email.

Please do the following steps in order:
1. Search Google Drive for a file named "${resumeFileName}" and get its file ID.
2. Compose and send an email via Gmail with:
   - To: ${job.applyEmail}
   - Subject: Application for ${job.title} — ${yourName}
   - Body: The cover letter below, exactly as written
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

    const text = response.content.filter(b => b.type === 'text').map(b => b.text).join(' ');
    logger.info(`[Phase 3] 📧 Email sent for "${job.title}": ${text.slice(0, 100)}...`);
    return true;
  } catch (err) {
    logger.error(`[Phase 3] Email failed for "${job.title}": ${err.message}`);
    return false;
  }
}

export async function executeApplications(qualifiedJobs) {
  let emailed = 0;
  let queued = 0;

  logger.info(`[Phase 3] Processing ${qualifiedJobs.length} qualified jobs...`);

  for (const job of qualifiedJobs) {
    if (job.isEmailApply && job.applyEmail && job.coverLetter) {
      const sent = await sendEmailApplication(job);
      if (sent) emailed++;
      else queued++; // fall back to queue if email fails
    } else {
      // Platform apply — already sent to Supabase via jobs_batch callback
      logger.info(`[Phase 3] 📋 Platform apply: "${job.title}" @ ${job.company} (Score: ${job.score}/10)`);
      queued++;
    }
  }

  logger.info(`[Phase 3] Done — ${emailed} emails sent, ${queued} in queue`);
  return { emailed, queued };
}
