import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

const publicRoutes = createRouteMatcher([
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/api/webhooks/clerk',
])

export default clerkMiddleware(async (auth, req) => {
  if (!publicRoutes(req)) {
    await auth.protect()
  }
})

export const config = {
  matcher: [
    // Skip static files, _next internals, and the large-upload API route
    '/((?!_next|.*\\..*)(?!api/process).*)',
    '/(api(?!/process)|trpc)(.*)',
    '/__clerk/(.*)',
  ],
}
