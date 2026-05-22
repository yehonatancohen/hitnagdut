import { auth } from '@clerk/nextjs/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: user } = await supabaseAdmin
    .from('users')
    .select('id')
    .eq('clerk_id', userId)
    .single()

  if (!user) return Response.json({ jobs: [] })

  const { data: jobs } = await supabaseAdmin
    .from('jobs')
    .select('id, created_at, file_names, file_count, clause_count, status')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(50)

  return Response.json({ jobs: jobs ?? [] })
}

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: user } = await supabaseAdmin
    .from('users')
    .select('id')
    .eq('clerk_id', userId)
    .single()

  if (!user) return Response.json({ error: 'User not found' }, { status: 404 })

  const body = await req.json()
  const { file_names, file_count, clause_count, result_json } = body

  const { data, error } = await supabaseAdmin
    .from('jobs')
    .insert({ user_id: user.id, file_names, file_count, clause_count, result_json })
    .select('id')
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ id: data.id })
}
