import { Webhook } from 'svix'
import { headers } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(req: Request) {
  const body = await req.text()
  const headersList = await headers()

  const svixId = headersList.get('svix-id')
  const svixTimestamp = headersList.get('svix-timestamp')
  const svixSignature = headersList.get('svix-signature')

  if (!svixId || !svixTimestamp || !svixSignature) {
    return new Response('Missing svix headers', { status: 400 })
  }

  const wh = new Webhook(process.env.CLERK_WEBHOOK_SECRET!)
  let event: any

  try {
    event = wh.verify(body, {
      'svix-id': svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': svixSignature,
    })
  } catch {
    return new Response('Invalid signature', { status: 400 })
  }

  if (event.type === 'user.created') {
    const { id, email_addresses, first_name, last_name } = event.data
    const email = email_addresses?.[0]?.email_address ?? null
    const name = [first_name, last_name].filter(Boolean).join(' ') || null

    const { data: user, error } = await supabaseAdmin
      .from('users')
      .insert({ clerk_id: id, email, name })
      .select('id')
      .single()

    if (!error && user) {
      await supabaseAdmin
        .from('user_credits')
        .insert({ user_id: user.id, credits_remaining: 0 })
    }
  }

  if (event.type === 'user.updated') {
    const { id, email_addresses, first_name, last_name } = event.data
    const email = email_addresses?.[0]?.email_address ?? null
    const name = [first_name, last_name].filter(Boolean).join(' ') || null

    await supabaseAdmin
      .from('users')
      .update({ email, name })
      .eq('clerk_id', id)
  }

  if (event.type === 'user.deleted') {
    await supabaseAdmin
      .from('users')
      .delete()
      .eq('clerk_id', event.data.id)
  }

  return new Response('OK', { status: 200 })
}
