/**
 * PHASE 2: EVALUATION
 * Uses per-user settings from GitHub Actions env vars.
 * Resume text is extracted from the downloaded PDF (or loaded from text file).
 */

import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs/promises';
import { logger } from './logger.js';

const client = new Anthropic();

async function getResume() {
  // Try plain text first
  try {
    return await fs.readFile(process.env.RESUME_PATH ?? './data/resume.txt', 'utf-8');
  } catch {}

  // Fall back to extracting text from PDF
  const pdfPath = `./data/${process.env.RESUME_FILENAME ?? 'resume.pdf'}`;
  try {
    const pdfParse = (await import('pdf-parse')).default;
    const buffer = await fs.readFile(pdfPath);
    const data = await pdfParse(buffer);
    // Cache extracted text
    await fs.writeFile('./data/resume.txt', data.text, 'utf-8');
    logger.info('[Phase 2] Extracted text from resume PDF');
    return data.text;
  } catch (err) {
    logger.warn(`[Phase 2] Could not load resume: ${err.message}`);
    return '[RESUME NOT LOADED]';
  }
}

function buildSystemPrompt(resume) {
  const skills = process.env.SKILLS_TEXT ? `\nThe candidate has highlighted these skills: ${process.env.SKILLS_TEXT}` : '';
  const location = process.env.LOCATION ? `\nThe candidate's base location is ${process.env.LOCATION} with a ${process.env.LOCATION_RADIUS ?? 50}-mile radius for in-person roles.` : '';
  const remoteOnly = process.env.REMOTE_ONLY === 'true' ? '\n- Only remote or hybrid roles are acceptable.' : '';

  return `You are a precise, critical job-fit evaluator. Your job is to assess whether a job listing is a strong match for a specific candidate.

Here is the candidate's resume:
<resume>
${resume}
</resume>
${skills}

Evaluation criteria:
- Score the fit from 1–10 based on skill overlap with the candidate's experience
- The candidate's strict salary floor is $${process.env.SALARY_FLOOR ?? '110000'}/year${remoteOnly}${location}
- The role must be for an individual contributor or manager, NOT a director/VP/C-suite level
- DISQUALIFY (score 1) if the role is explicitly on-site only AND located outside the candidate's area
- DISQUALIFY (score 1) if the role is explicitly part-time, contract-only, freelance, volunteer, or temporary

You must respond ONLY with a valid JSON object — no preamble, no markdown fences. Schema:
{
  "score": <integer 1-10>,
  "scoreReason": "<2-3 sentence explanation>",
  "salaryConfirmed": <true if meets floor or unspecified, false if explicitly below>,
  "salaryNote": "<what the JD says about comp, or 'Not specified'>",
  "isEmailApply": <true if listing instructs applicants to email a resume directly>,
  "applyEmail": "<email address if isEmailApply is true, else null>",
  "coverLetter": "<only if score >= ${process.env.SCORE_THRESHOLD ?? 7}: 3-paragraph tailored cover letter. Otherwise null>"
}`;
}

async function scoreJob(job, resume) {
  const userContent = `Please evaluate this job listing:

Title: ${job.title}
Company: ${job.company}
Source: ${job.source}
URL: ${job.url}

Job Description:
${job.description?.slice(0, 6000) ?? 'No description available.'}`;

  try {
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: buildSystemPrompt(resume),
      messages: [{ role: 'user', content: userContent }],
    });

    const raw = message.content[0]?.text ?? '{}';
    const clean = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed = JSON.parse(clean);

    return {
      ...job,
      score:           parsed.score ?? 0,
      scoreReason:     parsed.scoreReason ?? '',
      salaryConfirmed: parsed.salaryConfirmed ?? true,
      salaryNote:      parsed.salaryNote ?? 'Not specified',
      isEmailApply:    parsed.isEmailApply ?? false,
      applyEmail:      parsed.applyEmail ?? null,
      coverLetter:     parsed.coverLetter ?? null,
    };
  } catch (err) {
    logger.error(`[Phase 2] Scoring failed for "${job.title}": ${err.message}`);
    return null;
  }
}

export async function evaluateJobs(jobs) {
  const SCORE_THRESHOLD = parseInt(process.env.SCORE_THRESHOLD ?? '7', 10);
  logger.info(`[Phase 2] Evaluating ${jobs.length} jobs (threshold: ${SCORE_THRESHOLD})...`);

  const resume = await getResume();
  const qualified = [];

  for (const job of jobs) {
    const result = await scoreJob(job, resume);
    if (!result) continue;

    logger.info(`[Phase 2] "${result.title}" @ ${result.company} — Score: ${result.score}/10 | Salary OK: ${result.salaryConfirmed}`);

    if (result.score >= SCORE_THRESHOLD && result.salaryConfirmed) {
      logger.info(`[Phase 2] ✅ QUALIFIED: ${result.title} @ ${result.company}`);
      qualified.push(result);
    }
  }

  logger.info(`[Phase 2] ${qualified.length} jobs passed threshold out of ${jobs.length}`);
  return qualified;
}
