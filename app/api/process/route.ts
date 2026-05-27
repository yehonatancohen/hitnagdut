import { createHmac } from 'crypto'
import { NextRequest } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getCredits, deductCredit, isUserBlocked, ensureUser } from '@/lib/credits'
import sql from '@/lib/db'

export const maxDuration = 300
export const dynamic = 'force-dynamic'

const BACKEND_URL     = process.env.BACKEND_URL     || 'http://localhost:8000'
const BACKEND_API_KEY = process.env.BACKEND_API_KEY || ''

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'יש להתחבר כדי להשתמש במערכת.' }, { status: 401 })

  const contentType = req.headers.get('content-type') || ''

  // ── JSON actions: stage3 / excel / save_job ───────────────────────────────
  if (contentType.includes('application/json')) {
    const body = await req.json()
    const { action } = body

    if (action === 'stage3') {
      const { section_title, clauses } = body
      try {
        const res = await fetch(`${BACKEND_URL}/stage3`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-internal-key': BACKEND_API_KEY },
          body: JSON.stringify({ section_title, clauses }),
        })
        if (!res.ok) return Response.json({ error: 'Backend stage3 failed' }, { status: 500 })
        return Response.json(await res.json())
      } catch (err: any) {
        return Response.json({ error: err.message || 'Stage 3 failed' }, { status: 500 })
      }
    }

    if (action === 'excel') {
      const { objections, mode, fileName } = body
      try {
        const res = await fetch(`${BACKEND_URL}/excel`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-internal-key': BACKEND_API_KEY },
          body: JSON.stringify({ objections, mode, fileName }),
        })
        if (!res.ok) return Response.json({ error: 'Backend excel failed' }, { status: 500 })
        return Response.json(await res.json())
      } catch (err: any) {
        return Response.json({ error: err.message || 'Excel failed' }, { status: 500 })
      }
    }

    if (action === 'save_job') {
      const { file_names, file_count, clause_count, result_json } = body
      const [user] = await sql`SELECT id FROM users WHERE clerk_id = ${userId}`
      if (user) {
        await sql`
          INSERT INTO jobs (user_id, file_names, file_count, clause_count, result_json)
          VALUES (${user.id}, ${file_names}, ${file_count}, ${clause_count}, ${sql.json(result_json)})
        `
      }
      return Response.json({ ok: true })
    }

    if (action === 'init') {
      await ensureUser(userId)
      const blocked = await isUserBlocked(userId)
      if (blocked) return Response.json({ error: 'חשבונך חסום. צור קשר עם התמיכה.' }, { status: 403 })
      const credits = await getCredits(userId)
      if (credits <= 0) return Response.json({ error: 'אין קרדיטים זמינים. רכוש קרדיטים בדשבורד.' }, { status: 402 })
      await deductCredit(userId)
      const expiresAt = Date.now() + 600_000 // 10 minutes
      const payload = `${userId}:${expiresAt}`
      const sig = createHmac('sha256', BACKEND_API_KEY).update(payload).digest('hex')
      return Response.json({ token: `${payload}:${sig}` })
    }

    if (action === 'process_session') {
      const { session_id, file_names } = body
      let backendRes: Response
      try {
        backendRes = await fetch(`${BACKEND_URL}/process-session`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-internal-key': BACKEND_API_KEY },
          body: JSON.stringify({ session_id, file_names }),
        })
      } catch {
        return Response.json({ error: 'לא ניתן להתחבר לשרת העיבוד.' }, { status: 503 })
      }
      if (!backendRes.ok || !backendRes.body) {
        return Response.json({ error: 'שגיאה בשרת העיבוד.' }, { status: 502 })
      }
      return new Response(backendRes.body, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'X-Accel-Buffering': 'no',
        },
      })
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 })
  }

  return Response.json({ error: 'Unsupported content type' }, { status: 415 })
}
