'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'

export default function ResponsesPage() {
  const { user, isLoading } = useAuth()
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const checkAdminStatus = async () => {
      if (!user) return
      
      // Check if user is an admin
      const { data, error } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single()
      
      if (error || data?.role !== 'admin') {
        // Not an admin, redirect to user dashboard
        router.push('/dashboard')
      }
    }
    
    if (user && !isLoading) {
      checkAdminStatus()
      setLoading(false)
    }
  }, [user, isLoading, router])
  
  if (isLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#080808]">
        <div className="w-8 h-8 border-t-2 border-[#FFB900] rounded-full animate-spin"></div>
      </div>
    )
  }

  return (
    <div className="p-10">
      <div className="flex justify-between items-center mb-10">
        <h1 className="text-white text-4xl font-bold">Responses</h1>
        
        <Link href="/admin/create" className="px-4 py-2 bg-white rounded-md text-black flex items-center space-x-1">
          <span className="font-medium">Create New</span>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M8 3.33325V12.6666" stroke="black" strokeWidth="1.33" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M3.33301 8H12.6663" stroke="black" strokeWidth="1.33" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </Link>
      </div>
      
      <div className="bg-[#121212] border border-white/5 p-6 text-center">
        <p className="text-white text-xl">Responses page is under development</p>
      </div>
    </div>
  )
} 