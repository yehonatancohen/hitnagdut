import { auth } from '@clerk/nextjs/server'
import { getCredits, ensureUser } from '@/lib/credits'

export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    await ensureUser(userId)

    const credits = await getCredits(userId)
    return Response.json({ credits })
  } catch (err) {
    console.error('[/api/credits]', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
