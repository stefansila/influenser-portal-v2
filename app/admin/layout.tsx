'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import AdminSidebar from '../components/AdminSidebar'
import { AdminNotificationProvider } from '../context/AdminNotificationContext'
import { AdminChatProvider } from '../context/AdminChatContext'

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { isLoading, isAuthenticated, user } = useAuth()
  const [isAdmin, setIsAdmin] = useState(false)
  const [checking, setChecking] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const checkAdminAccess = async () => {
      // Simple auth check - redirect if not authenticated
      if (!isLoading && !isAuthenticated) {
        router.push('/login')
        return
      }
      
      if (!isLoading && isAuthenticated && user) {
        try {
          // Check if user is admin
          const { data, error } = await supabase
            .from('users')
            .select('role')
            .eq('id', user.id)
            .single()
          
          if (error || data?.role !== 'admin') {
            // Not an admin, redirect to dashboard
            router.push('/dashboard')
            return
          }
          
          setIsAdmin(true)
        } catch (error) {
          console.error('Error checking admin status:', error)
          router.push('/dashboard')
        } finally {
          setChecking(false)
        }
      }
    }
    
    checkAdminAccess()
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

  // Don't render if not authenticated or not admin (redirects handled above)
  if (!isAuthenticated || !isAdmin) {
    return null
  }

  return (
    <AdminNotificationProvider>
      <AdminChatProvider>
        <div className="flex flex-col lg:flex-row h-screen bg-gray-100 gap-2 lg:gap-0">
          <AdminSidebar />
          <main className="flex-1 overflow-y-auto">
            {children}
          </main>
        </div>
      </AdminChatProvider>
    </AdminNotificationProvider>
  )
} 