import { auth } from '@clerk/nextjs/server'
import sql from '@/lib/db'

export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const [user] = await sql`SELECT id FROM users WHERE clerk_id = ${userId}`
    if (!user) return Response.json({ jobs: [] })

    const jobs = await sql`
      SELECT id, created_at, file_names, file_count, clause_count, status
      FROM jobs
      WHERE user_id = ${user.id}
      ORDER BY created_at DESC
      LIMIT 50
    `
    return Response.json({ jobs })
  } catch (err) {
    console.error('[/api/jobs GET]', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const [user] = await sql`SELECT id FROM users WHERE clerk_id = ${userId}`
    if (!user) return Response.json({ error: 'User not found' }, { status: 404 })

    const { file_names, file_count, clause_count, result_json } = await req.json()

    const [job] = await sql`
      INSERT INTO jobs (user_id, file_names, file_count, clause_count, result_json)
      VALUES (${user.id}, ${file_names}, ${file_count}, ${clause_count}, ${sql.json(result_json)})
      RETURNING id
    `
    return Response.json({ id: job.id })
  } catch (err) {
    console.error('[/api/jobs POST]', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
