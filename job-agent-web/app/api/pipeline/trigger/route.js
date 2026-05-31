import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

// POST /api/pipeline/trigger
// Triggers a GitHub Actions workflow_dispatch for this user's pipeline run
export async function POST(req) {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const db = supabaseAdmin();

  // Get user + settings
  const { data: user } = await db.from('users').select('id').eq('email', session.user.email).single();
  if (!user) return Response.json({ error: 'User not found' }, { status: 404 });

  const { data: settings } = await db.from('user_settings').select('*').eq('user_id', user.id).single();
  if (!settings) return Response.json({ error: 'Complete your settings first' }, { status: 400 });

  // Prevent double-runs
  const { data: activeRun } = await db
    .from('pipeline_runs')
    .select('id')
    .eq('user_id', user.id)
    .eq('status', 'running')
    .single();
  if (activeRun) return Response.json({ error: 'A pipeline run is already in progress' }, { status: 409 });

  // Create a pending run record
  const { data: run, error: runError } = await db
    .from('pipeline_runs')
    .insert({ user_id: user.id, status: 'pending' })
    .select()
    .single();
  if (runError) return Response.json({ error: runError.message }, { status: 500 });

  // Get a signed download URL for the resume (valid 1 hour)
  let resumeSignedUrl = null;
  if (settings.resume_filename) {
    const { data: signed } = await db.storage
      .from('resumes')
      .createSignedUrl(`${user.id}/${settings.resume_filename}`, 3600);
    resumeSignedUrl = signed?.signedUrl;
  }

  // Trigger GitHub Actions workflow_dispatch
  const githubRes = await fetch(
    `https://api.github.com/repos/${process.env.GITHUB_OWNER}/${process.env.GITHUB_REPO}/actions/workflows/pipeline.yml/dispatches`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ref: 'main',
        inputs: {
          run_id:          run.id,
          user_id:         user.id,
          job_titles:      (settings.job_titles ?? []).join(','),
          salary_floor:    String(settings.salary_floor ?? 110000),
          score_threshold: String(settings.score_threshold ?? 7),
          location:        settings.location ?? '',
          location_radius: String(settings.location_radius ?? 50),
          remote_only:     String(settings.remote_only ?? true),
          your_name:       settings.your_name ?? '',
          your_email:      settings.your_email ?? '',
          skills_text:     settings.skills_text ?? '',
          resume_url:      resumeSignedUrl ?? '',
          resume_filename: settings.resume_filename ?? '',
          callback_url:    `${process.env.NEXTAUTH_URL}/api/pipeline/callback`,
          webhook_secret:  process.env.PIPELINE_WEBHOOK_SECRET,
          adzuna_app_id:   process.env.ADZUNA_APP_ID ?? '',
          adzuna_app_key:  process.env.ADZUNA_APP_KEY ?? '',
        },
      }),
    }
  );

  if (!githubRes.ok) {
    const body = await githubRes.text();
    await db.from('pipeline_runs').update({ status: 'failed', error_message: body }).eq('id', run.id);
    return Response.json({ error: 'GitHub Actions trigger failed', detail: body }, { status: 500 });
  }

  // Update run to "running"
  await db.from('pipeline_runs').update({ status: 'running' }).eq('id', run.id);

  return Response.json({ ok: true, run_id: run.id });
}
