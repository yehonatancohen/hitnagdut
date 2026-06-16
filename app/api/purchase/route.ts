import { auth } from '@clerk/nextjs/server'

// Real payment processing isn't wired up yet — refuse instead of silently
// granting credits. Re-enable once a payment provider is integrated.
export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  return Response.json(
    { error: 'רכישת קרדיטים אינה זמינה כעת. בקרוב.' },
    { status: 503 }
  )
}
