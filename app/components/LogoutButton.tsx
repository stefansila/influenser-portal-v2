'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../lib/supabase'

export default function LogoutButton({ className = '' }: { className?: string }) {
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()
  
  const handleLogout = async () => {
    setIsLoading(true)
    try {
  
      await supabase.auth.signOut()
      router.push('/login')
      router.refresh()
    } catch (error) {
      console.error('Error signing out:', error)
    } finally {
      setIsLoading(false)
    }
  }
  
  return (
    <button 
      onClick={handleLogout}
      disabled={isLoading}
      className={className}
    >
      {isLoading ? 'Logging out...' : 'Logout'}
    </button>
  )
} 