import { supabaseAdmin } from './supabase'

// Creates the user + credits row if they don't exist yet.
// Call this at the start of any authenticated API route instead of relying on the webhook.
export async function ensureUser(
  clerkId: string,
  profile?: { email?: string | null; name?: string | null }
): Promise<string> {
  const { data: existing } = await supabaseAdmin
    .from('users')
    .select('id')
    .eq('clerk_id', clerkId)
    .single()

  if (existing) return existing.id

  const { data: created, error } = await supabaseAdmin
    .from('users')
    .insert({ clerk_id: clerkId, email: profile?.email ?? null, name: profile?.name ?? null })
    .select('id')
    .single()

  if (error || !created) throw new Error('Failed to create user: ' + error?.message)

  await supabaseAdmin
    .from('user_credits')
    .insert({ user_id: created.id, credits_remaining: 0 })

  return created.id
}

export async function getCredits(clerkId: string): Promise<number> {
  const { data: user } = await supabaseAdmin
    .from('users')
    .select('id')
    .eq('clerk_id', clerkId)
    .single()

  if (!user) return 0

  const { data } = await supabaseAdmin
    .from('user_credits')
    .select('credits_remaining')
    .eq('user_id', user.id)
    .single()

  return data?.credits_remaining ?? 0
}

export async function deductCredit(clerkId: string): Promise<boolean> {
  const { data: user } = await supabaseAdmin
    .from('users')
    .select('id')
    .eq('clerk_id', clerkId)
    .single()

  if (!user) return false

  const { data } = await supabaseAdmin
    .from('user_credits')
    .select('credits_remaining')
    .eq('user_id', user.id)
    .single()

  const current = data?.credits_remaining ?? 0
  if (current <= 0) return false

  const { error } = await supabaseAdmin
    .from('user_credits')
    .update({ credits_remaining: current - 1, updated_at: new Date().toISOString() })
    .eq('user_id', user.id)

  return !error
}

export async function addCredits(clerkId: string, amount: number): Promise<void> {
  const { data: user } = await supabaseAdmin
    .from('users')
    .select('id')
    .eq('clerk_id', clerkId)
    .single()

  if (!user) return

  const { data: existing } = await supabaseAdmin
    .from('user_credits')
    .select('credits_remaining')
    .eq('user_id', user.id)
    .single()

  if (existing) {
    await supabaseAdmin
      .from('user_credits')
      .update({ credits_remaining: existing.credits_remaining + amount, updated_at: new Date().toISOString() })
      .eq('user_id', user.id)
  } else {
    await supabaseAdmin
      .from('user_credits')
      .insert({ user_id: user.id, credits_remaining: amount })
  }
}

export async function isUserBlocked(clerkId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from('users')
    .select('is_blocked')
    .eq('clerk_id', clerkId)
    .single()
  return data?.is_blocked ?? false
}
