import { auth } from '@clerk/nextjs/server'
import { getOrCreateReferralCode } from '@/lib/referral'

export async function GET() {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const code = await getOrCreateReferralCode(userId)
  return Response.json({ code })
}
