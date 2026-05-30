import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

// GET /api/user/settings
export async function GET(req) {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const db = supabaseAdmin();
  const { data: user } = await db.from('users').select('id').eq('email', session.user.email).single();
  if (!user) return Response.json({ error: 'User not found' }, { status: 404 });

  const { data } = await db.from('user_settings').select('*').eq('user_id', user.id).single();
  return Response.json(data ?? {});
}

// POST /api/user/settings
export async function POST(req) {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const db = supabaseAdmin();
  const { data: user } = await db.from('users').select('id').eq('email', session.user.email).single();
  if (!user) return Response.json({ error: 'User not found' }, { status: 404 });

  const formData = await req.formData();
  const resumeFile = formData.get('resume');

  let resume_url = null;
  let resume_filename = null;
  let resume_text = null;

  // Handle resume upload
  if (resumeFile && resumeFile.size > 0) {
    const bytes = await resumeFile.arrayBuffer();
    const fileName = `${user.id}/${resumeFile.name}`;

    const { error: uploadError } = await db.storage
      .from('resumes')
      .upload(fileName, bytes, {
        contentType: 'application/pdf',
        upsert: true,
      });

    if (!uploadError) {
      const { data: urlData } = db.storage.from('resumes').getPublicUrl(fileName);
      resume_url = urlData?.publicUrl;
      resume_filename = resumeFile.name;
    }
  }

  // Parse job_titles from comma-separated string or array
  const rawTitles = formData.get('job_titles');
  const job_titles = rawTitles
    ? rawTitles.split(',').map(t => t.trim()).filter(Boolean)
    : undefined;

  const settings = {
    user_id: user.id,
    your_name:       formData.get('your_name') ?? undefined,
    your_email:      formData.get('your_email') ?? undefined,
    skills_text:     formData.get('skills_text') ?? undefined,
    job_titles:      job_titles,
    salary_floor:    formData.get('salary_floor') ? parseInt(formData.get('salary_floor')) : undefined,
    score_threshold: formData.get('score_threshold') ? parseInt(formData.get('score_threshold')) : undefined,
    location:        formData.get('location') ?? undefined,
    location_radius: formData.get('location_radius') ? parseInt(formData.get('location_radius')) : undefined,
    remote_only:     formData.get('remote_only') === 'true' || formData.get('remote_only') === 'on',
    updated_at:      new Date().toISOString(),
    ...(resume_url       && { resume_url }),
    ...(resume_filename  && { resume_filename }),
  };

  // Remove undefined keys
  Object.keys(settings).forEach(k => settings[k] === undefined && delete settings[k]);

  const { error } = await db.from('user_settings').upsert(settings, { onConflict: 'user_id' });
  if (error) return Response.json({ error: error.message }, { status: 500 });

  // Mark user as onboarded
  await db.from('users').update({ onboarded: true }).eq('id', user.id);

  return Response.json({ ok: true });
}
