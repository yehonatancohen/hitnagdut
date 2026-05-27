import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { validateUploadToken } from '@/lib/upload-token'

const protectedPages = createRouteMatcher([
  '/',
  '/dashboard(.*)',
  '/admin(.*)',
])

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8000'
const BACKEND_API_KEY = process.env.BACKEND_API_KEY || ''

export default clerkMiddleware(async (auth, req: NextRequest) => {
  // Upload proxy — validates HMAC token then rewrites to FastAPI backend.
  // Uses NextResponse.rewrite() so the body is streamed through Vercel's edge
  // proxy layer, which respects proxyClientMaxBodySize (50MB), not the 4.5MB
  // Lambda/Edge function limit.
  // process-session-direct: JSON body → FastAPI /process-session (SSE stream)
  if (req.nextUrl.pathname === '/api/process-session-direct') {
    const token = req.headers.get('x-upload-token') || ''
    const valid = await validateUploadToken(token)
    if (!valid) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    const target = new URL('/process-session', BACKEND_URL)
    const headers = new Headers(req.headers)
    headers.set('x-internal-key', BACKEND_API_KEY)
    headers.delete('x-upload-token')
    headers.delete('host')
    return NextResponse.rewrite(target, { request: { headers } })
  }

  if (req.nextUrl.pathname === '/api/upload-direct') {
    const token = req.headers.get('x-upload-token') || ''
    const valid = await validateUploadToken(token)
    if (!valid) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    const target = new URL('/process', BACKEND_URL)
    const headers = new Headers(req.headers)
    headers.set('x-internal-key', BACKEND_API_KEY)
    headers.delete('x-upload-token')
    headers.delete('host')
    return NextResponse.rewrite(target, { request: { headers } })
  }

  // Only redirect to sign-in for page routes — API routes handle auth themselves
  // to avoid Vercel edge caching Clerk's 404 protect-rewrite for API paths
  if (protectedPages(req)) {
    await auth.protect()
  }
})

export const config = {
  matcher: [
    '/((?!_next|.*\\..*).*)',
    '/(api(?!/process)|trpc)(.*)',
    '/__clerk/(.*)',
  ],
}
