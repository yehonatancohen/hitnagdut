'use client'

import { Suspense, useEffect, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { useUser } from '@clerk/nextjs'

const REF_COOKIE = 'ref_code'

function ReferralCaptureInner() {
  const searchParams = useSearchParams()
  const { isSignedIn } = useUser()
  const redeemed = useRef(false)

  useEffect(() => {
    const ref = searchParams.get('ref')
    if (ref) {
      document.cookie = `${REF_COOKIE}=${encodeURIComponent(ref)}; path=/; max-age=${60 * 60 * 24 * 30}`
    }
  }, [searchParams])

  useEffect(() => {
    if (!isSignedIn || redeemed.current) return
    if (!document.cookie.includes(`${REF_COOKIE}=`)) return
    redeemed.current = true
    fetch('/api/referral/redeem', { method: 'POST' }).catch(() => {})
  }, [isSignedIn])

  return null
}

export default function ReferralCapture() {
  return (
    <Suspense fallback={null}>
      <ReferralCaptureInner />
    </Suspense>
  )
}
