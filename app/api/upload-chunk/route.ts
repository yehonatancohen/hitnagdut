import { createHmac } from 'crypto'
import { NextRequest } from 'next/server'

export const maxDuration = 60
export const dynamic = 'force-dynamic'

const BACKEND_URL     = process.env.BACKEND_URL     || 'http://localhost:8000'
const BACKEND_API_KEY = process.env.BACKEND_API_KEY || ''

function validateToken(token: string): boolean {
  const parts = token.split(':')
  if (parts.length !== 3) return false
  const [userId, expiresAtStr, sig] = parts
  const expiresAt = parseInt(expiresAtStr, 10)
  if (isNaN(expiresAt) || expiresAt < Date.now()) return false
  const expected = createHmac('sha256', BACKEND_API_KEY)
    .update(`${userId}:${expiresAtStr}`)
    .digest('hex')
  if (sig.length !== expected.length) return false
  let diff = 0
  for (let i = 0; i < sig.length; i++) diff |= sig.charCodeAt(i) ^ expected.charCodeAt(i)
  return diff === 0
}

export async function POST(req: NextRequest) {
  const token = req.headers.get('x-upload-token') || ''
  if (!validateToken(token)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const contentType = req.headers.get('content-type') || ''
  if (!contentType.includes('multipart/form-data')) {
    return Response.json({ error: 'Expected multipart/form-data' }, { status: 400 })
  }

  let backendRes: Response
  try {
    backendRes = await fetch(`${BACKEND_URL}/upload-chunk`, {
      method: 'POST',
      headers: {
        'x-internal-key': BACKEND_API_KEY,
        'content-type': contentType,
      },
      body: req.body,
    } as RequestInit)
  } catch {
    return Response.json({ error: 'לא ניתן להתחבר לשרת העיבוד.' }, { status: 503 })
  }

  if (!backendRes.ok) {
    const text = await backendRes.text().catch(() => '')
    return Response.json({ error: text || 'שגיאת שרת' }, { status: backendRes.status })
  }

  return Response.json({ ok: true })
}
