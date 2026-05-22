import { auth } from '@clerk/nextjs/server'
import { getCredits } from '@/lib/credits'

export async function GET() {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const credits = await getCredits(userId)
  return Response.json({ credits })
}
