import { randomBytes } from 'crypto'
import sql from './db'
import { ensureUser } from './credits'

function generateCode(): string {
  return randomBytes(5).toString('hex')
}

export async function getOrCreateReferralCode(clerkId: string): Promise<string> {
  const userId = await ensureUser(clerkId)

  const [existing] = await sql`SELECT referral_code FROM users WHERE id = ${userId}`
  if (existing?.referral_code) return existing.referral_code as string

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateCode()
    try {
      await sql`UPDATE users SET referral_code = ${code} WHERE id = ${userId}`
      return code
    } catch {
      // unique violation — retry with a new code
    }
  }
  throw new Error('Failed to generate referral code')
}

// Credits the inviter exactly once per invitee. No-op if there's no valid,
// unused referral code, or the user is trying to refer themself.
export async function redeemReferral(clerkId: string, code: string | undefined): Promise<boolean> {
  if (!code) return false

  const userId = await ensureUser(clerkId)

  const [user] = await sql`SELECT referred_by FROM users WHERE id = ${userId}`
  if (user?.referred_by) return false

  const [inviter] = await sql`SELECT id FROM users WHERE referral_code = ${code}`
  if (!inviter || inviter.id === userId) return false

  await sql`UPDATE users SET referred_by = ${inviter.id} WHERE id = ${userId} AND referred_by IS NULL`
  await sql`
    UPDATE user_credits uc SET credits_remaining = credits_remaining + 1, updated_at = NOW()
    WHERE uc.user_id = ${inviter.id}
  `
  return true
}
