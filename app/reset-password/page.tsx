'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import AlertUtils from '../components/AlertUtils'
import { Toaster } from 'react-hot-toast'

// Create a redirection key unique to this page
const REDIRECT_KEY = 'reset_password_redirect_check';

export default function ResetPassword() {
  const [email, setEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [pageMounted, setPageMounted] = useState(false)
  const [resetToken, setResetToken] = useState<string | null>(null)
  const [isResetMode, setIsResetMode] = useState(false)
  const [tokenValidated, setTokenValidated] = useState(false)
  
  const router = useRouter()
  const { isAuthenticated, user, isLoading: authLoading } = useAuth()
  const searchParams = useSearchParams()

  // Check for reset parameters and validate token
  useEffect(() => {
    const emailParam = searchParams.get('email')
    const tokenParam = searchParams.get('token')
    
    if (emailParam && tokenParam) {
      setIsResetMode(true)
      setEmail(emailParam)
      setResetToken(tokenParam)
      
      // Validate the reset token only if not already validated
      if (!tokenValidated) {
        validateResetToken(emailParam, tokenParam)
      }
    } else {
      setIsResetMode(false)
    }
  }, [searchParams, tokenValidated])

  const validateResetToken = async (email: string, token: string) => {
    // Prevent multiple validation attempts
    const validationKey = `reset_validation_${email}_${token}`
    if (typeof window !== 'undefined' && sessionStorage.getItem(validationKey)) {
      return
    }
    
    try {
      const response = await fetch('/api/validate-password-reset', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, token }),
      })
      
      const result = await response.json()
      
      if (result.valid) {
        setTokenValidated(true)
        // Only show success message once
        if (typeof window !== 'undefined' && !sessionStorage.getItem(`${validationKey}_success`)) {
          sessionStorage.setItem(`${validationKey}_success`, 'true')
          AlertUtils.success('Token Valid', 'Your password reset token has been validated. Please enter your new password.')
        }
      } else {
        setTokenValidated(false)
        // Only show error message once
        if (typeof window !== 'undefined' && !sessionStorage.getItem(`${validationKey}_error`)) {
          sessionStorage.setItem(`${validationKey}_error`, 'true')
          AlertUtils.error('Invalid Token', result.message || 'This password reset link is invalid or has expired.')
        }
      }
      
      // Mark validation as attempted
      if (typeof window !== 'undefined') {
        sessionStorage.setItem(validationKey, 'true')
      }
    } catch (err) {
      console.error('Error validating reset token:', err)
      setTokenValidated(false)
      // Only show error message once
      const errorKey = `${validationKey}_network_error`
      if (typeof window !== 'undefined' && !sessionStorage.getItem(errorKey)) {
        sessionStorage.setItem(errorKey, 'true')
        AlertUtils.error('Validation Error', 'Failed to validate password reset token. Please try again.')
      }
    }
  }
  
  // Mark the page as mounted
  useEffect(() => {
    setPageMounted(true);
    
    // Cleanup to remove the lock when component unmounts
    return () => {
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem(REDIRECT_KEY);
        // Clean up validation session storage on unmount
        const keys = Object.keys(sessionStorage);
        keys.forEach(key => {
          if (key.startsWith('reset_validation_')) {
            sessionStorage.removeItem(key);
          }
        });
      }
    };
  }, []);
  
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

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!email) {
      setError('Please enter your email address')
      return
    }
    
    setIsLoading(true)
    setError(null)
    setSuccessMessage(null)
    
    try {
      const response = await fetch('/api/request-password-reset', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      })
      
      const result = await response.json()
      
      if (result.success) {
        setSuccessMessage('Reset password link sent! Check your email inbox.')
        AlertUtils.success('Email Sent', result.message)
      } else {
        setError(result.error || 'Failed to send reset password email')
        AlertUtils.error('Error', result.error || 'Failed to send reset password email')
      }
    } catch (err) {
      setError('An unexpected error occurred')
      AlertUtils.error('Error', 'An unexpected error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validation
    if (!newPassword || !confirmPassword) {
      setError('Please fill in all password fields')
      return
    }
    
    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters long')
      return
    }
    
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match')
      return
    }
    
    // If in reset mode, check if token is validated
    if (isResetMode && !tokenValidated) {
      setError('Please use a valid password reset link.')
      return
    }
    
    setIsLoading(true)
    setError(null)
    setSuccessMessage(null)
    
    try {
      const response = await fetch('/api/reset-password-with-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          token: resetToken,
          newPassword,
        }),
      })
      
      const result = await response.json()
      
      if (result.success) {
        AlertUtils.success('Password Reset', 'Your password has been reset successfully!')
        
        // Redirect to login after successful password reset
        setTimeout(() => {
          router.push('/login')
        }, 2000)
      } else {
        setError(result.error || 'Failed to reset password')
        AlertUtils.error('Reset Failed', result.error || 'Failed to reset password')
      }
    } catch (err) {
      setError('An unexpected error occurred')
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
      {/* Reset Password form - Centered on screen */}
      <div className="w-full flex items-center justify-center">
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
            <h1 className="text-4xl font-bold text-textPrimary">
              {isResetMode ? 'Set New Password' : 'Reset Password'}
            </h1>
            <p className="text-textSecondary">
              {isResetMode 
                ? 'Enter your new password below to complete the reset process.'
                : 'Enter your email address and we\'ll send you a link to reset your password.'
              }
            </p>
            {isResetMode && (
              <div className={`p-3 rounded-md border ${
                tokenValidated 
                  ? 'bg-green-900/20 border-green-500/30 text-green-200' 
                  : 'bg-yellow-900/20 border-yellow-500/30 text-yellow-200'
              }`}>
                <p className="text-sm">
                  {tokenValidated 
                    ? '✓ Password reset token validated successfully'
                    : '⏳ Validating password reset token...'
                  }
                </p>
              </div>
            )}
          </div>
          
          {/* Form */}
          <form onSubmit={isResetMode ? handlePasswordReset : handleEmailSubmit} className="space-y-8">
            {/* Success message */}
            {successMessage && (
              <div className="bg-green-900/20 text-green-400 px-4 py-3 rounded-md">
                {successMessage}
              </div>
            )}
            
            <div className="space-y-3">
              {/* Email input */}
              <div>
                <input 
                  type="email" 
                  placeholder="Email" 
                  className={`input-field focus:border-white text-white ${isResetMode ? 'bg-gray-700 cursor-not-allowed' : ''}`}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading || isResetMode}
                />
                {isResetMode && (
                  <p className="mt-1 text-xs text-textTertiary">
                    Email is pre-filled from your reset link
                  </p>
                )}
              </div>
              
              {/* Password fields - only show in reset mode */}
              {isResetMode && (
                <>
                  {/* New Password input with eye icon */}
                  <div className="relative">
                    <input 
                      type={showPassword ? "text" : "password"}
                      placeholder="New Password" 
                      className="input-field focus:border-white text-white"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      disabled={isLoading}
                      required
                      minLength={6}
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

                  {/* Confirm Password input with eye icon */}
                  <div className="relative">
                    <input 
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder="Confirm New Password" 
                      className="input-field focus:border-white text-white"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      disabled={isLoading}
                      required
                      minLength={6}
                    />
                    <button 
                      type="button"
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400"
                      aria-label="Toggle confirm password visibility"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
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
                </>
              )}
              
              {/* Error message */}
              {error && (
                <div className="text-red-500 text-sm mt-1">{error}</div>
              )}
            </div>
            
            {/* Submit button and back to login */}
            <div className="flex items-center space-x-5">
              <button 
                type="submit" 
                className="primary-button w-3/5"
                disabled={isLoading || (isResetMode && !tokenValidated)}
              >
                <span>
                  {isLoading 
                    ? (isResetMode ? 'Resetting...' : 'Sending...') 
                    : (isResetMode ? 'Reset Password' : 'Send Reset Link')
                  }
                </span>
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
              
              <div className="text-sm text-white">
                <p>Remember your password?</p>
                <p className="text-yellow-400 cursor-pointer" onClick={() => router.push('/login')}>
                  Log In
                </p>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
} 