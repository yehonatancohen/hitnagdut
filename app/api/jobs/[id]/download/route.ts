import { auth } from '@clerk/nextjs/server'
import sql from '@/lib/db'

const BACKEND_URL     = process.env.BACKEND_URL     || 'http://localhost:8000'
const BACKEND_API_KEY = process.env.BACKEND_API_KEY || ''

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const [job] = await sql`
    SELECT j.result_json, j.file_names
    FROM jobs j
    JOIN users u ON u.id = j.user_id
    WHERE j.id = ${id} AND u.clerk_id = ${userId}
  `
  if (!job) return Response.json({ error: 'Not found' }, { status: 404 })

  const fileName = job.file_names?.[0]?.replace(/\.pdf$/i, '') || 'התנגדויות_מאוגדות'

  let backendRes: Response
  try {
    backendRes = await fetch(`${BACKEND_URL}/excel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-internal-key': BACKEND_API_KEY },
      body: JSON.stringify({ objections: job.result_json, mode: 'merged', fileName }),
    })
  } catch {
    return Response.json({ error: 'לא ניתן להתחבר לשרת העיבוד.' }, { status: 503 })
  }
  if (!backendRes.ok) return Response.json({ error: 'שגיאה ביצירת קובץ ה-Excel' }, { status: 502 })

  const { file, fileName: outName } = await backendRes.json()
  const bytes = Buffer.from(file, 'base64')

  return new Response(bytes, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${encodeURIComponent(outName)}"`,
    },
  })
}
