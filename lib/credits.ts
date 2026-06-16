import sql from './db'

export async function ensureUser(
  clerkId: string,
  profile?: { email?: string | null; name?: string | null }
): Promise<string> {
  const [existing] = await sql`SELECT id FROM users WHERE clerk_id = ${clerkId}`
  if (existing) return existing.id as string

  const [created] = await sql`
    INSERT INTO users (clerk_id, email, name)
    VALUES (${clerkId}, ${profile?.email ?? null}, ${profile?.name ?? null})
    ON CONFLICT (clerk_id) DO UPDATE SET email = EXCLUDED.email, name = EXCLUDED.name
    RETURNING id
  `
  await sql`
    INSERT INTO user_credits (user_id, credits_remaining)
    VALUES (${created.id}, 1)
    ON CONFLICT (user_id) DO NOTHING
  `
  return created.id as string
}

export async function getCredits(clerkId: string): Promise<number> {
  const [row] = await sql`
    SELECT uc.credits_remaining
    FROM users u
    JOIN user_credits uc ON uc.user_id = u.id
    WHERE u.clerk_id = ${clerkId}
  `
  return (row?.credits_remaining as number) ?? 0
}

// Atomically deducts one credit — returns false if balance was already 0
export async function deductCredit(clerkId: string): Promise<boolean> {
  const [row] = await sql`
    UPDATE user_credits uc
    SET credits_remaining = uc.credits_remaining - 1, updated_at = NOW()
    FROM users u
    WHERE uc.user_id = u.id
      AND u.clerk_id = ${clerkId}
      AND uc.credits_remaining > 0
    RETURNING uc.credits_remaining
  `
  return !!row
}

export async function addCredits(clerkId: string, amount: number): Promise<void> {
  await sql`
    UPDATE user_credits uc
    SET credits_remaining = uc.credits_remaining + ${amount}, updated_at = NOW()
    FROM users u
    WHERE uc.user_id = u.id AND u.clerk_id = ${clerkId}
  `
}

export async function isUserBlocked(clerkId: string): Promise<boolean> {
  const [row] = await sql`SELECT is_blocked FROM users WHERE clerk_id = ${clerkId}`
  return (row?.is_blocked as boolean) ?? false
}
