'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function OldProposalRedirect({ params }: { params: { id: string } }) {
  const router = useRouter()
  
  useEffect(() => {
    // Redirect to the new route
    router.replace(`/dashboard/proposal/${params.id}`)
  }, [router, params.id])

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <div className="w-8 h-8 border-t-2 border-white rounded-full animate-spin"></div>
    </div>
  )
} 