const BACKEND_API_KEY = process.env.BACKEND_API_KEY || ''

export async function validateUploadToken(token: string): Promise<boolean> {
  const parts = token.split(':')
  if (parts.length !== 3) return false
  const [userId, expiresAtStr, sig] = parts
  const expiresAt = parseInt(expiresAtStr, 10)
  if (isNaN(expiresAt) || expiresAt < Date.now()) return false

  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(BACKEND_API_KEY),
    { name: 'HMAC', hash: 'SHA-256' },
    false, ['sign']
  )
  const expectedBuf = await crypto.subtle.sign('HMAC', key, enc.encode(`${userId}:${expiresAtStr}`))
  const expectedHex = Array.from(new Uint8Array(expectedBuf))
    .map(b => b.toString(16).padStart(2, '0')).join('')

  if (sig.length !== expectedHex.length) return false
  let diff = 0
  for (let i = 0; i < sig.length; i++) diff |= sig.charCodeAt(i) ^ expectedHex.charCodeAt(i)
  return diff === 0
}
