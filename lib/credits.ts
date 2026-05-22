import { supabaseAdmin } from './supabase'

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
