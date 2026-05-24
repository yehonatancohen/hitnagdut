import { auth, currentUser } from '@clerk/nextjs/server'
import { getCredits, ensureUser } from '@/lib/credits'

export async function GET() {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await currentUser()
  await ensureUser(userId, {
    email: user?.emailAddresses[0]?.emailAddress,
    name: [user?.firstName, user?.lastName].filter(Boolean).join(' ') || null,
  })

  const credits = await getCredits(userId)
  return Response.json({ credits })
}
