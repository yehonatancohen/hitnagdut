import { createClient, SupabaseClient } from '@supabase/supabase-js'

// Lazy singleton — avoids crashing at build time when env vars aren't present
let _instance: SupabaseClient | null = null

function getInstance(): SupabaseClient {
  if (!_instance) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) throw new Error('Supabase env vars not configured')
    _instance = createClient(url, key)
  }
  return _instance
}

export const supabaseAdmin = new Proxy({} as SupabaseClient, {
  get(_, prop: string) {
    return (getInstance() as any)[prop]
  },
})

export type UserRole = 'user' | 'admin'

export interface DbUser {
  id: string
  clerk_id: string
  email: string | null
  name: string | null
  role: UserRole
  is_blocked: boolean
  created_at: string
}

export interface DbJob {
  id: string
  user_id: string
  created_at: string
  file_names: string[]
  file_count: number
  clause_count: number
  result_json: unknown
  status: string
}
