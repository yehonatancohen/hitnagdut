import { auth } from '@clerk/nextjs/server'
import sql from '@/lib/db'

async function assertAdmin(clerkId: string) {
  const [row] = await sql`SELECT role FROM users WHERE clerk_id = ${clerkId}`
  if (row?.role !== 'admin') throw new Error('Forbidden')
}

export async function GET() {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  try { await assertAdmin(userId) } catch { return Response.json({ error: 'Forbidden' }, { status: 403 }) }

  const users = await sql`
    SELECT u.id, u.clerk_id, u.email, u.name, u.role, u.is_blocked, u.created_at,
           COALESCE(uc.credits_remaining, 0) AS credits_remaining
    FROM users u
    LEFT JOIN user_credits uc ON uc.user_id = u.id
    ORDER BY u.created_at DESC
  `
  return Response.json({ users })
}

export async function PATCH(req: Request) {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  try { await assertAdmin(userId) } catch { return Response.json({ error: 'Forbidden' }, { status: 403 }) }

  const { user_id, action, amount } = await req.json()

  if (action === 'block') {
    await sql`UPDATE users SET is_blocked = TRUE  WHERE id = ${user_id}`
  } else if (action === 'unblock') {
    await sql`UPDATE users SET is_blocked = FALSE WHERE id = ${user_id}`
  } else if (action === 'add_credits' && typeof amount === 'number') {
    await sql`
      INSERT INTO user_credits (user_id, credits_remaining)
      VALUES (${user_id}, ${amount})
      ON CONFLICT (user_id) DO UPDATE
        SET credits_remaining = user_credits.credits_remaining + ${amount},
            updated_at = NOW()
    `
  } else if (action === 'set_role' && (amount === 'admin' || amount === 'user')) {
    const [self] = await sql`SELECT id FROM users WHERE clerk_id = ${userId}`
    if (self?.id === user_id && amount !== 'admin') {
      return Response.json({ error: 'Cannot remove your own admin role' }, { status: 400 })
    }
    await sql`UPDATE users SET role = ${amount} WHERE id = ${user_id}`
  } else {
    return Response.json({ error: 'Invalid action' }, { status: 400 })
  }

  return Response.json({ ok: true })
}
