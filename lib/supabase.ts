import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Server-side client with full privileges (never expose to browser)
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

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
