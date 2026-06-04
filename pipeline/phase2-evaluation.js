/**
 * PHASE 2: EVALUATION LAYER
 * Routes each job description through Claude.
 * Claude scores fit against your resume, checks salary floor,
 * and generates a tailored cover letter for high-scoring matches.
 *
 * Output per qualifying job:
 * { ...job, score, scoreReason, salaryConfirmed, coverLetter }
 */

import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs/promises';
import { logger } from '../utils/logger.js';

const client = new Anthropic(); // reads ANTHROPIC_API_KEY from env automatically

// ─── Load Resume ──────────────────────────────────────────────────────────────

let _resumeCache = null;

async function getResume() {
  if (_resumeCache) return _resumeCache;
  try {
    _resumeCache = await fs.readFile(process.env.RESUME_PATH ?? './data/resume.txt', 'utf-8');
    return _resumeCache;
  } catch {
    logger.warn('[Phase 2] resume.txt not found — using placeholder. Add your resume to ./data/resume.txt');
    _resumeCache = '[RESUME NOT LOADED — add your resume text to ./data/resume.txt]';
    return _resumeCache;
  }
}

// ─── Prompt Builder ───────────────────────────────────────────────────────────

function buildSystemPrompt(resume) {
  return `You are a precise, critical job-fit evaluator. Your job is to assess whether a job listing is a strong match for a specific candidate.

Here is the candidate's resume:
<resume>
${resume}
</resume>

Evaluation criteria:
- Score the fit from 1–10 based on skill overlap (Okta, ZTNA, IaC, Vendor Management, and related IT/systems skills are high value)
- The candidate's strict salary floor is $${process.env.SALARY_FLOOR ?? '110000'}/year
- Only remote or hybrid roles are acceptable
- The role must be for an individual contributor or manager, NOT a director/VP/C-suite level
- DISQUALIFY (score 1) if the role is explicitly on-site only AND located outside the Salt Lake Valley
- DISQUALIFY (score 1) if the role is explicitly part-time, contract-only, freelance, volunteer, or temporary
- DISQUALIFY (score 1) if the role requires visa sponsorship — candidate is legally eligible to work in the US and does not need sponsorship
- BOOST score (+1) if the role lists hands-on Microsoft 365 administration as a requirement or strong preference — candidate has direct M365 admin experience
- BOOST score (+1) if the role lists experience managing an IT ticketing system as a requirement or preference — candidate has direct experience
You must respond ONLY with a valid JSON object — no preamble, no markdown fences. The schema is:
{
  "score": <integer 1-10>,
  "scoreReason": "<2-3 sentence explanation of why this score>",
  "salaryConfirmed": <true if salary meets floor or is unspecified (give benefit of doubt), false if explicitly below floor>,
  "salaryNote": "<what the JD says about comp, or 'Not specified'>",
  "requiresVisaSponsorship": <true if the role explicitly states it cannot or will not sponsor visas, false otherwise>,
  "requiresM365": <true if the role mentions M365 / Microsoft 365 admin experience>,
  "requiresTicketing": <true if the role mentions IT ticketing system experience>,
  "isEmailApply": <true if the listing instructs applicants to email a resume directly>,
  "applyEmail": "<email address if isEmailApply is true, else null>",
  "coverLetter": "<only if score >= ${process.env.SCORE_THRESHOLD ?? 8}: a 3-paragraph tailored cover letter. Otherwise null>"
}`;
}

// ─── Score a Single Job ───────────────────────────────────────────────────────

async function scoreJob(job, resume) {
  const userContent = `Please evaluate this job listing:

Title: ${job.title}
Company: ${job.company}
Source: ${job.source}
URL: ${job.url}

Job Description:
${job.description?.slice(0, 6000) ?? 'No description available.'}`; // trim to avoid token abuse

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
      score: parsed.score ?? 0,
      scoreReason: parsed.scoreReason ?? '',
      salaryConfirmed: parsed.salaryConfirmed ?? true,
      salaryNote: parsed.salaryNote ?? 'Not specified',
      requiresVisaSponsorship: parsed.requiresVisaSponsorship ?? false,
      requiresM365: parsed.requiresM365 ?? false,
      requiresTicketing: parsed.requiresTicketing ?? false,
      isEmailApply: parsed.isEmailApply ?? false,
      applyEmail: parsed.applyEmail ?? null,
      coverLetter: parsed.coverLetter ?? null,
    };
  } catch (err) {
    logger.error(`[Phase 2] Scoring failed for "${job.title}" at ${job.company}: ${err.message}`);
    return null;
  }
}

// ─── Main Export ──────────────────────────────────────────────────────────────

const SCORE_THRESHOLD = parseInt(process.env.SCORE_THRESHOLD ?? '7', 10);

export async function evaluateJobs(jobs) {
  logger.info(`[Phase 2] Evaluating ${jobs.length} new jobs...`);

  const resume = await getResume();
  const qualifiedJobs = [];

  // Score sequentially to avoid hammering the API — bump to Promise.all with
  // a concurrency limiter (e.g. p-limit) if you want to run batches in parallel
  for (const job of jobs) {
    const result = await scoreJob(job, resume);
    if (!result) continue;

    logger.info(
      `[Phase 2] "${result.title}" @ ${result.company} — Score: ${result.score}/10 | Salary OK: ${result.salaryConfirmed} | M365: ${result.requiresM365} | Ticketing: ${result.requiresTicketing}`
    );

    if (result.score >= SCORE_THRESHOLD && result.salaryConfirmed) {
      logger.info(`[Phase 2] ✅ QUALIFIED: ${result.title} @ ${result.company}`);
      qualifiedJobs.push(result);
    }
  }

  logger.info(`[Phase 2] ${qualifiedJobs.length} jobs passed the threshold out of ${jobs.length}`);
  return qualifiedJobs;
}
