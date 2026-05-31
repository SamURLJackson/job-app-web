import { supabaseAdmin } from '@/lib/supabase';

// POST /api/pipeline/callback
// Called by the GitHub Actions pipeline when it finishes a batch of jobs or completes
// Secured by PIPELINE_WEBHOOK_SECRET
export async function POST(req) {
  const secret = req.headers.get('x-webhook-secret');
  if (secret !== process.env.PIPELINE_WEBHOOK_SECRET) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const { run_id, user_id, event, data } = body;

  if (!run_id || !user_id || !event) {
    return Response.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const db = supabaseAdmin();

  if (event === 'jobs_batch') {
    // Insert a batch of qualified jobs
    const jobs = (data.jobs ?? []).map(job => ({
      user_id,
      run_id,
      title:          job.title,
      company:        job.company,
      url:            job.url,
      source:         job.source,
      salary_note:    job.salaryNote,
      score:          job.score,
      score_reason:   job.scoreReason,
      is_email_apply: job.isEmailApply ?? false,
      apply_email:    job.applyEmail ?? null,
      cover_letter:   job.coverLetter ?? null,
      status:         'pending',
    }));

    if (jobs.length > 0) {
      await db.from('job_queue').insert(jobs);
    }

    return Response.json({ ok: true, inserted: jobs.length });
  }

  if (event === 'complete') {
    await db.from('pipeline_runs').update({
      status:         'complete',
      jobs_fetched:   data.jobs_fetched ?? 0,
      jobs_qualified: data.jobs_qualified ?? 0,
      emails_sent:    data.emails_sent ?? 0,
      queued_count:   data.queued_count ?? 0,
      completed_at:   new Date().toISOString(),
    }).eq('id', run_id);

    return Response.json({ ok: true });
  }

  if (event === 'failed') {
    await db.from('pipeline_runs').update({
      status:        'failed',
      error_message: data.error ?? 'Unknown error',
      completed_at:  new Date().toISOString(),
    }).eq('id', run_id);

    return Response.json({ ok: true });
  }

  return Response.json({ error: 'Unknown event' }, { status: 400 });
}
