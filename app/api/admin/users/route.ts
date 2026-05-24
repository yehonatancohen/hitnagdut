import { auth } from '@clerk/nextjs/server'
import { supabaseAdmin } from '@/lib/supabase'

async function assertAdmin(clerkId: string) {
  const { data } = await supabaseAdmin
    .from('users').select('role').eq('clerk_id', clerkId).single()
  if (data?.role !== 'admin') throw new Error('Forbidden')
}

export async function GET() {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  try { await assertAdmin(userId) } catch { return Response.json({ error: 'Forbidden' }, { status: 403 }) }

  const { data: users } = await supabaseAdmin
    .from('users')
    .select('id, clerk_id, email, name, role, is_blocked, created_at')
    .order('created_at', { ascending: false })

  const { data: credits } = await supabaseAdmin
    .from('user_credits')
    .select('user_id, credits_remaining')

  const creditsMap = Object.fromEntries((credits ?? []).map(c => [c.user_id, c.credits_remaining]))

  const result = (users ?? []).map(u => ({ ...u, credits_remaining: creditsMap[u.id] ?? 0 }))
  return Response.json({ users: result })
}

export async function PATCH(req: Request) {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  try { await assertAdmin(userId) } catch { return Response.json({ error: 'Forbidden' }, { status: 403 }) }

  const body = await req.json()
  const { user_id, action, amount } = body

  if (action === 'block') {
    await supabaseAdmin.from('users').update({ is_blocked: true }).eq('id', user_id)
  } else if (action === 'unblock') {
    await supabaseAdmin.from('users').update({ is_blocked: false }).eq('id', user_id)
  } else if (action === 'add_credits' && typeof amount === 'number') {
    const { data: uc } = await supabaseAdmin
      .from('user_credits').select('credits_remaining').eq('user_id', user_id).single()
    const current = uc?.credits_remaining ?? 0
    await supabaseAdmin
      .from('user_credits')
      .upsert({ user_id, credits_remaining: current + amount, updated_at: new Date().toISOString() })
  } else if (action === 'set_role' && (amount === 'admin' || amount === 'user')) {
    // Prevent self-demotion
    const { data: self } = await supabaseAdmin
      .from('users').select('id').eq('clerk_id', userId).single()
    if (self?.id === user_id && amount !== 'admin') {
      return Response.json({ error: 'Cannot remove your own admin role' }, { status: 400 })
    }
    await supabaseAdmin.from('users').update({ role: amount }).eq('id', user_id)
  } else {
    return Response.json({ error: 'Invalid action' }, { status: 400 })
  }

  return Response.json({ ok: true })
}
