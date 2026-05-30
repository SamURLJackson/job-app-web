import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

// GET /api/pipeline/runs
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const db = supabaseAdmin();
  const { data: user } = await db.from('users').select('id').eq('email', session.user.email).single();
  if (!user) return Response.json([]);

  const { data } = await db
    .from('pipeline_runs')
    .select('*')
    .eq('user_id', user.id)
    .order('started_at', { ascending: false })
    .limit(20);

  return Response.json(data ?? []);
}
