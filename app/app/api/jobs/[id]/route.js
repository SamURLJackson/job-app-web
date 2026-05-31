import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

// PATCH /api/jobs/[id]
export async function PATCH(req, { params }) {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const db = supabaseAdmin();
  const { data: user } = await db.from('users').select('id').eq('email', session.user.email).single();
  if (!user) return Response.json({ error: 'User not found' }, { status: 404 });

  const body = await req.json();
  const updates = {};

  if (body.status) {
    updates.status = body.status;
    if (body.status === 'applied') updates.applied_at = new Date().toISOString();
  }
  if (body.notes !== undefined) updates.notes = body.notes;

  const { error } = await db
    .from('job_queue')
    .update(updates)
    .eq('id', params.id)
    .eq('user_id', user.id); // ensures user can only edit their own jobs

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
