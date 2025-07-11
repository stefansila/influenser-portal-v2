'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from './context/AuthContext'
import { supabase } from './lib/supabase'

export default function Home() {
  const { isAuthenticated, user, isLoading } = useAuth()
  const router = useRouter()
  
  // Handle redirection based on auth state
  useEffect(() => {
    const handleRedirect = async () => {
      if (isLoading) return;
      
      if (isAuthenticated && user) {
        // Get user role from database
        const { data } = await supabase.from('users')
          .select('role')
          .eq('id', user.id)
          .single()
        
        if (data?.role === 'admin') {
          router.push('/admin');
        } else {
          router.push('/dashboard');
        }
      } else {
        router.push('/login');
      }
    }
    
    handleRedirect()
  }, [isAuthenticated, user, isLoading, router]);
  
  // Simple loading spinner while redirecting
  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <div className="w-8 h-8 border-t-2 border-white rounded-full animate-spin"></div>
    </div>
  )
} 