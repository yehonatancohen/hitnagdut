import { NextRequest } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { supabaseAdmin } from '@/lib/supabase'

const BUCKET = 'temp-uploads'

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { files } = await req.json() as { files: Array<{ name: string }> }

  await supabaseAdmin.storage.createBucket(BUCKET, { public: false }).catch(() => {})

  const urls = await Promise.all(
    files.map(async ({ name }: { name: string }) => {
      const safeName = name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const path = `${userId}/${Date.now()}-${safeName}`
      const { data, error } = await supabaseAdmin.storage
        .from(BUCKET)
        .createSignedUploadUrl(path)
      if (error) throw new Error(error.message)
      return { path, signedUrl: data.signedUrl, name }
    })
  )

  return Response.json(urls)
}
