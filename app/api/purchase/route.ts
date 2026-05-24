import { auth } from '@clerk/nextjs/server'
import { addCredits, ensureUser } from '@/lib/credits'
import { supabaseAdmin } from '@/lib/supabase'

const PLANS = {
  single:     { credits: 1,  price_ils: 29,  label: 'עבודה בודדת' },
  bundle_10:  { credits: 10, price_ils: 199, label: '10 עבודות' },
  monthly_50: { credits: 50, price_ils: 399, label: 'מנוי חודשי 50 עבודות' },
} as const

type PlanKey = keyof typeof PLANS

export async function POST(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const plan = body.plan as PlanKey

    if (!PLANS[plan]) return Response.json({ error: 'Invalid plan' }, { status: 400 })

    await ensureUser(userId)

    const { credits, price_ils } = PLANS[plan]

    await addCredits(userId, credits)

    const { data: user } = await supabaseAdmin
      .from('users').select('id').eq('clerk_id', userId).single()

    if (user) {
      await supabaseAdmin.from('purchases').insert({
        user_id: user.id,
        plan,
        credits_added: credits,
        price_ils,
      })
    }

    return Response.json({ ok: true, credits_added: credits })
  } catch (e) {
    console.error('Purchase error:', e)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
