import { auth } from '@clerk/nextjs/server'
import sql from '@/lib/db'

export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const [user] = await sql`
      SELECT u.id, COALESCE(uc.credits_remaining, 0) AS credits
      FROM users u
      LEFT JOIN user_credits uc ON uc.user_id = u.id
      WHERE u.clerk_id = ${userId}
    `
    if (!user) return Response.json({ credits: 0, jobs: [] })

    const jobs = await sql`
      SELECT id, created_at, file_names, file_count, clause_count, status
      FROM jobs
      WHERE user_id = ${user.id}
      ORDER BY created_at DESC
      LIMIT 50
    `
    return Response.json({ credits: user.credits, jobs })
  } catch (err) {
    console.error('[/api/dashboard GET]', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
