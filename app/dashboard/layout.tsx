'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import Sidebar from '../components/Sidebar'
import ClientProviders from '../components/ClientProviders'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { isLoading, isAuthenticated, user } = useAuth()
  const [checking, setChecking] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const checkAccess = async () => {
      // Simple auth check - redirect if not authenticated
      if (!isLoading && !isAuthenticated) {
        router.push('/login')
        return
      }
      
      if (!isLoading && isAuthenticated && user) {
        try {
          // Check if user is admin
          const { data } = await supabase
            .from('users')
            .select('role')
            .eq('id', user.id)
            .single()
          
          // If user is admin, redirect to admin panel
          if (data?.role === 'admin') {
            router.push('/admin')
            return
          }
          
          setChecking(false)
        } catch (error) {
          console.error('Error checking user role:', error)
          setChecking(false)
        }
      }
    }
    
    checkAccess()
  }, [isLoading, isAuthenticated, user, router])

  // Show loading while checking auth
  if (isLoading || checking) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  // Don't render if not authenticated
  if (!isAuthenticated) {
    return null
  }

  return (
    <ClientProviders>
      <div className="flex h-screen bg-gray-100">
        <Sidebar />
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </ClientProviders>
  )
} 