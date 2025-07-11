'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { useAuth } from '../context/AuthContext'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '../lib/supabase'
import AlertUtils from '../components/AlertUtils'
import { Toaster } from 'react-hot-toast'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  
  const { signIn, isAuthenticated, user, isLoading: authLoading } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()

  // Handle redirection if already authenticated
  useEffect(() => {
    const checkRedirect = async () => {
      if (authLoading) return;
      
      if (isAuthenticated && user) {
        // Get user role from database
        const { data } = await supabase.from('users')
          .select('role')
          .eq('id', user.id)
          .single()
        
        const destination = data?.role === 'admin' ? '/admin' : '/dashboard';
        router.push(destination);
      }
    }
    
    checkRedirect()
  }, [isAuthenticated, user, authLoading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!email || !password) {
      AlertUtils.warning('Validation Error', 'Please enter both email and password')
      return
    }
    
    setIsLoading(true)
    
    try {
      const { error } = await signIn(email, password)
      
      if (error) {
        AlertUtils.error('Login Failed', error.message || 'Invalid email or password')
      } else {
        AlertUtils.success('Login Successful', 'Welcome back!')
        // Auth context will update and useEffect will handle redirection
      }
    } catch (err) {
      AlertUtils.error('Error', 'An unexpected error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  // Show loading state if auth is still being checked
  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="w-8 h-8 border-t-2 border-white rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background">
      <Toaster position="top-right" />
      {/* Login form - Centered on screen */}
      <div className="w-full flex items-center justify-center p-4">
        <div className="w-full max-w-[505px] px-4 py-6 space-y-8">
          {/* Logo */}
          <div className="mb-8">
            <Image 
              src="https://fbmdbvijfufsjpsuorxi.supabase.co/storage/v1/object/public/company-logos/logos/Vector.svg" 
              alt="Logo" 
              width={40} 
              height={40} 
              className="navbar-logo" 
            />
          </div>
          
          {/* Heading */}
          <div className="space-y-4">
            <h1 className="text-4xl font-bold text-textPrimary">Log In</h1>
            <p className="text-textSecondary">
              Log in to your account to continue where you left off.
            </p>
          </div>
          
          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-8">
            <div className="space-y-3">
              {/* Email input */}
              <div>
                <input 
                  type="email" 
                  placeholder="Email" 
                  className="input-field focus:border-white text-white"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading}
                />
              </div>
              
              {/* Password input with eye icon */}
              <div className="relative">
                <input 
                  type={showPassword ? "text" : "password"}
                  placeholder="Password" 
                  className="input-field focus:border-white text-white"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                />
                <button 
                  type="button"
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400"
                  aria-label="Toggle password visibility"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  <svg 
                    width="21" 
                    height="17" 
                    viewBox="0 0 21 17" 
                    fill="none" 
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path 
                      d="M10.5 0C5.8 0 1.9 3 0 7.5C1.9 12 5.8 15 10.5 15C15.2 15 19.1 12 21 7.5C19.1 3 15.2 0 10.5 0ZM10.5 12.5C7.7 12.5 5.5 10.3 5.5 7.5C5.5 4.7 7.7 2.5 10.5 2.5C13.3 2.5 15.5 4.7 15.5 7.5C15.5 10.3 13.3 12.5 10.5 12.5ZM10.5 4.5C8.8 4.5 7.5 5.8 7.5 7.5C7.5 9.2 8.8 10.5 10.5 10.5C12.2 10.5 13.5 9.2 13.5 7.5C13.5 5.8 12.2 4.5 10.5 4.5Z" 
                      fill="#434343"
                    />
                  </svg>
                </button>
              </div>
            </div>
            
            {/* Login button and forgot password - Stack on mobile, side by side on tablet+ */}
            <div className="flex flex-col sm:flex-row sm:items-center space-y-4 sm:space-y-0 sm:space-x-5">
              <button 
                type="submit" 
                className="primary-button w-full sm:w-3/5"
                disabled={isLoading}
              >
                <span>{isLoading ? 'Logging in...' : 'Log In'}</span>
                <svg 
                  width="7" 
                  height="14" 
                  viewBox="0 0 7 14" 
                  fill="none" 
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path 
                    d="M1 1L6 7L1 13" 
                    stroke="#131110" 
                    strokeWidth="1.67" 
                    strokeLinecap="round" 
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
              
              <div className="text-sm text-white text-center sm:text-left">
                <p>Forgot Password?</p>
                <p className="text-yellow-400 cursor-pointer" onClick={() => router.push('/reset-password')}>Reset Now</p>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
} 