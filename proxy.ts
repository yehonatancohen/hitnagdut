import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

const protectedPages = createRouteMatcher([
  '/',
  '/dashboard(.*)',
  '/admin(.*)',
])

export default clerkMiddleware(async (auth, req) => {
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
