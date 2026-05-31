import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

// GET /api/jobs?status=pending
export async function GET(req) {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status') ?? 'pending';

  const db = supabaseAdmin();
  const { data: user } = await db.from('users').select('id').eq('email', session.user.email).single();
  if (!user) return Response.json([]);

  const { data } = await db
    .from('job_queue')
    .select('*')
    .eq('user_id', user.id)
    .eq('status', status)
    .order('score', { ascending: false })
    .order('created_at', { ascending: false });

  return Response.json(data ?? []);
}
