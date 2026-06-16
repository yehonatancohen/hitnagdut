import { auth } from '@clerk/nextjs/server'
import { cookies } from 'next/headers'
import { redeemReferral } from '@/lib/referral'

const REF_COOKIE = 'ref_code'

export async function POST() {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const cookieStore = await cookies()
  const code = cookieStore.get(REF_COOKIE)?.value

  const redeemed = await redeemReferral(userId, code)
  if (code) cookieStore.delete(REF_COOKIE)

  return Response.json({ redeemed })
}
