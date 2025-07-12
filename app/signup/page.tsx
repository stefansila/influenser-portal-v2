'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import Image from 'next/image'
import { useAuth } from '../context/AuthContext'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '../lib/supabase'
import AlertUtils from '../components/AlertUtils'
import { Toaster } from 'react-hot-toast'

// Create a redirection key unique to this page
const REDIRECT_KEY = 'signup_redirect_check';

function SignUpForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [pageMounted, setPageMounted] = useState(false)
  const [inviteToken, setInviteToken] = useState<string | null>(null)
  const [inviteTagId, setInviteTagId] = useState<string | null>(null)
  const [isInviteMode, setIsInviteMode] = useState(false)
  const [inviteValidated, setInviteValidated] = useState(false)
  
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { signUp, isAuthenticated, user, isLoading: authLoading } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()

  // Check for invite parameters and validate token
  useEffect(() => {
    const emailParam = searchParams.get('email')
    const tokenParam = searchParams.get('token')
    const tagParam = searchParams.get('tag')
    
    if (emailParam && tokenParam && tagParam) {
      setIsInviteMode(true)
      setEmail(emailParam)
      setInviteToken(tokenParam)
      setInviteTagId(tagParam)
      
      // Validate the invite token only if not already validated
      if (!inviteValidated) {
        validateInviteToken(emailParam, tokenParam)
      }
    } else {
      // No invite parameters - redirect to login with error
      setIsInviteMode(false)
      // Only show error if we haven't already redirected
      if (typeof window !== 'undefined' && !sessionStorage.getItem('signup_redirect_attempted')) {
        sessionStorage.setItem('signup_redirect_attempted', 'true')
        AlertUtils.error('Access Restricted', 'Registration is only available through invitation. Please check your email for an invitation link.')
        router.push('/login')
      }
    }
  }, [searchParams, router]) // Removed inviteValidated to prevent loops

  const validateInviteToken = async (email: string, token: string) => {
    // Prevent multiple validation attempts
    const validationKey = `invite_validation_${email}_${token}`
    if (typeof window !== 'undefined' && sessionStorage.getItem(validationKey)) {
      return
    }
    
    try {
      const response = await fetch('/api/validate-invite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, token }),
      })
      
      const result = await response.json()
      
      if (result.valid) {
        setInviteValidated(true)
        // Only show success message once
        if (typeof window !== 'undefined' && !sessionStorage.getItem(`${validationKey}_success`)) {
          sessionStorage.setItem(`${validationKey}_success`, 'true')
          AlertUtils.success('Invitation Valid', 'Your invitation has been validated. Please complete your registration.')
        }
      } else {
        setInviteValidated(false)
        // Only show error message once
        if (typeof window !== 'undefined' && !sessionStorage.getItem(`${validationKey}_error`)) {
          sessionStorage.setItem(`${validationKey}_error`, 'true')
          AlertUtils.error('Invalid Invitation', result.message || 'This invitation link is invalid or has expired.')
        }
      }
      
      // Mark validation as attempted
      if (typeof window !== 'undefined') {
        sessionStorage.setItem(validationKey, 'true')
      }
    } catch (err) {
      console.error('Error validating invite:', err)
      setInviteValidated(false)
      // Only show error message once
      const errorKey = `${validationKey}_network_error`
      if (typeof window !== 'undefined' && !sessionStorage.getItem(errorKey)) {
        sessionStorage.setItem(errorKey, 'true')
        AlertUtils.error('Validation Error', 'Failed to validate invitation. Please try again.')
      }
    }
  }

  // Mark the page as mounted and clear redirection lock
  useEffect(() => {
    // Clear any existing redirection lock when signup page loads
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem(REDIRECT_KEY);
      // Clear any previous signup redirect attempts
      sessionStorage.removeItem('signup_redirect_attempted');
    }
    
    setPageMounted(true);
    
    // Cleanup to remove the lock when component unmounts
    return () => {
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem(REDIRECT_KEY);
        // Clean up validation session storage on unmount
        const keys = Object.keys(sessionStorage);
        keys.forEach(key => {
          if (key.startsWith('invite_validation_') || key === 'signup_redirect_attempted') {
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

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      // Check file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        AlertUtils.warning('File Too Large', 'Please select an image smaller than 5MB')
        return
      }
      
      // Check file type
      if (!file.type.startsWith('image/')) {
        AlertUtils.warning('Invalid File Type', 'Please select an image file')
        return
      }
      
      setAvatarFile(file)
      
      // Create preview
      const reader = new FileReader()
      reader.onload = (e) => {
        setAvatarPreview(e.target?.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Clear any redirection locks before attempting signup
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem(REDIRECT_KEY);
    }
    
    // Validation
    if (!email || !password || !fullName) {
      AlertUtils.warning('Validation Error', 'Please fill in all required fields')
      return
    }
    
    if (password.length < 6) {
      AlertUtils.warning('Validation Error', 'Password must be at least 6 characters long')
      return
    }
    
    if (password !== confirmPassword) {
      AlertUtils.warning('Validation Error', 'Passwords do not match')
      return
    }
    
    // If in invite mode, check if invitation is validated
    if (isInviteMode && !inviteValidated) {
      AlertUtils.error('Invalid Invitation', 'Please use a valid invitation link to register.')
      return
    }
    
    setIsLoading(true)
    
    try {
      
      // If we have an invite token, use the invite signup endpoint
      if (isInviteMode && inviteToken && inviteTagId) {
        const response = await fetch('/api/signup-with-invite', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email,
            password,
            fullName,
            phoneNumber,
            inviteToken,
            tagId: inviteTagId,
          }),
        })
        
        const result = await response.json()
        
        if (!response.ok || result.error) {
          AlertUtils.error('Sign Up Failed', result.error || 'Failed to create account with invitation')
          return
        }
        
        // Upload avatar if provided
        if (avatarFile && result.user) {
          // Handle avatar upload separately
          // For now, we'll skip this and use default avatar
        }
        
        AlertUtils.success('Account Created', 'Welcome! Your account has been created successfully with your invitation.')
        
        // Redirect based on user role
        const destination = result.userData?.role === 'admin' ? '/admin' : '/dashboard'
        router.push(destination)
      } else {
        // This should never happen since we redirect users without invites
        AlertUtils.error('Registration Restricted', 'Registration is only available through invitation.')
        router.push('/login')
      }
    } catch (err) {
      console.log("SignUp: Exception during sign up", err);
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
      {/* Sign up form - Centered on screen */}
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
            <h1 className="text-4xl font-bold text-textPrimary">
              {isInviteMode ? 'Complete Your Registration' : 'Sign Up'}
            </h1>
            <p className="text-textSecondary">
              {isInviteMode 
                ? 'You\'ve been invited to join our platform. Please complete your registration below.'
                : 'Create your account to get started with our platform.'
              }
            </p>
            {isInviteMode && (
              <div className={`p-3 rounded-md border ${
                inviteValidated 
                  ? 'bg-green-900/20 border-green-500/30 text-green-200' 
                  : 'bg-yellow-900/20 border-yellow-500/30 text-yellow-200'
              }`}>
                <p className="text-sm">
                  {inviteValidated 
                    ? '✓ Invitation validated successfully'
                    : '⏳ Validating invitation...'
                  }
                </p>
              </div>
            )}
          </div>
          
          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Avatar Upload */}
            <div className="flex flex-col items-center space-y-4">
              <div className="relative">
                <div className="w-24 h-24 rounded-full bg-gray-600 flex items-center justify-center overflow-hidden border-2 border-gray-500">
                  {avatarPreview ? (
                    <Image 
                      src={avatarPreview} 
                      alt="Avatar preview" 
                      width={96} 
                      height={96} 
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <svg 
                      className="w-12 h-12 text-gray-400" 
                      fill="currentColor" 
                      viewBox="0 0 20 20"
                    >
                      <path 
                        fillRule="evenodd" 
                        d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" 
                        clipRule="evenodd" 
                      />
                    </svg>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute -bottom-2 -right-2 bg-yellow-400 text-black rounded-full p-2 hover:bg-yellow-500 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </button>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarChange}
                className="hidden"
              />
              <p className="text-sm text-gray-400 text-center">
                Upload your avatar (optional)
              </p>
            </div>

            <div className="space-y-3">
              {/* Full Name input */}
              <div>
                <input 
                  type="text" 
                  placeholder="Full Name" 
                  className="input-field focus:border-white text-white"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  disabled={isLoading}
                  required
                />
              </div>

              {/* Email input */}
              <div>
                <input 
                  type="email" 
                  placeholder="Email" 
                  className={`input-field focus:border-white text-white ${isInviteMode ? 'bg-gray-700 cursor-not-allowed' : ''}`}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading || isInviteMode}
                  required
                />
                {isInviteMode && (
                  <p className="mt-1 text-xs text-textTertiary">
                    Email is pre-filled from your invitation
                  </p>
                )}
              </div>
              
              {/* Phone Number input */}
              <div>
                <input 
                  type="tel" 
                  placeholder="Phone Number (Optional)" 
                  className="input-field focus:border-white text-white"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
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
                  placeholder="Confirm Password" 
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
            </div>
            
            {/* Sign up button and login link */}
            <div className="flex flex-col sm:flex-row sm:items-center space-y-4 sm:space-y-0 sm:space-x-5">
              <button 
                type="submit" 
                className="primary-button w-full sm:w-3/5"
                disabled={isLoading}
              >
                <span>{isLoading ? 'Creating Account...' : 'Sign Up'}</span>
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
                <p>Already have an account?</p>
                <p className="text-yellow-400 cursor-pointer" onClick={() => router.push('/login')}>Log In</p>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

export default function SignUp() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <SignUpForm />
    </Suspense>
  );
} 