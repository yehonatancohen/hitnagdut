import { Webhook } from 'svix'
import { headers } from 'next/headers'
import sql from '@/lib/db'

export async function POST(req: Request) {
  const body = await req.text()
  const headersList = await headers()

  const svixId        = headersList.get('svix-id')
  const svixTimestamp = headersList.get('svix-timestamp')
  const svixSignature = headersList.get('svix-signature')

  if (!svixId || !svixTimestamp || !svixSignature) {
    return new Response('Missing svix headers', { status: 400 })
  }

  const wh = new Webhook(process.env.CLERK_WEBHOOK_SECRET!)
  let event: any
  try {
    event = wh.verify(body, { 'svix-id': svixId, 'svix-timestamp': svixTimestamp, 'svix-signature': svixSignature })
  } catch {
    return new Response('Invalid signature', { status: 400 })
  }

  if (event.type === 'user.created') {
    const { id, email_addresses, first_name, last_name } = event.data
    const email = email_addresses?.[0]?.email_address ?? null
    const name  = [first_name, last_name].filter(Boolean).join(' ') || null

    const [user] = await sql`
      INSERT INTO users (clerk_id, email, name)
      VALUES (${id}, ${email}, ${name})
      ON CONFLICT (clerk_id) DO NOTHING
      RETURNING id
    `
    if (user) {
      await sql`
        INSERT INTO user_credits (user_id, credits_remaining)
        VALUES (${user.id}, 0)
        ON CONFLICT (user_id) DO NOTHING
      `
    }
  }

  if (event.type === 'user.updated') {
    const { id, email_addresses, first_name, last_name } = event.data
    const email = email_addresses?.[0]?.email_address ?? null
    const name  = [first_name, last_name].filter(Boolean).join(' ') || null
    await sql`UPDATE users SET email = ${email}, name = ${name} WHERE clerk_id = ${id}`
  }

  if (event.type === 'user.deleted') {
    await sql`DELETE FROM users WHERE clerk_id = ${event.data.id}`
  }

  return new Response('OK', { status: 200 })
}
