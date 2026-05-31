import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

// GET /api/jobs/stats
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const db = supabaseAdmin();
  const { data: user } = await db.from('users').select('id').eq('email', session.user.email).single();
  if (!user) return Response.json({});

  const [runsRes, qualifiedRes, emailedRes, pendingRes] = await Promise.all([
    db.from('pipeline_runs').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
    db.from('job_queue').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
    db.from('pipeline_runs').select('emails_sent').eq('user_id', user.id),
    db.from('job_queue').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('status', 'pending'),
  ]);

  const total_emailed = (emailedRes.data ?? []).reduce((sum, r) => sum + (r.emails_sent ?? 0), 0);

  return Response.json({
    total_runs:      runsRes.count ?? 0,
    total_qualified: qualifiedRes.count ?? 0,
    total_emailed,
    pending_queue:   pendingRes.count ?? 0,
  });
}
