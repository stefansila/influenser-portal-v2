'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/app/lib/supabase'

function CompleteRegistrationForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  
  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isLoading, setIsLoading] = useState(true) // Start with loading state
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [tokenVerified, setTokenVerified] = useState(false)

  useEffect(() => {
    async function checkSession() {
      try {
        // Get token and email from URL
        const token = searchParams?.get('token');
        const queryEmail = searchParams?.get('email');
        
        console.log('URL Parameters:', 
          'token:', token, 
          'email:', queryEmail
        );
        
        if (!token || !queryEmail) {
          console.error('Missing token or email in URL');
          setError('Invalid registration link. Missing token or email parameters.');
          setIsLoading(false);
          return;
        }
        
        // Koristimo serversku API rutu za proveru pozivnice umesto direktnog pristupa
        console.log('Verifying invitation using admin API...');
        const response = await fetch(`/api/admin/verify-invitation?email=${encodeURIComponent(queryEmail)}&token=${encodeURIComponent(token)}`);
        const result = await response.json();
        
        console.log('Verification result:', result);
        
        if (!response.ok || !result.valid) {
          const errorMessage = result.message || 'Invalid or expired invitation token.';
          console.error('Invalid invitation:', errorMessage);
          throw new Error(errorMessage);
        }
        
        console.log('Valid invitation found:', result.invitation);
        
        // Pozivnica je pronađena i validna
        setEmail(queryEmail);
        setTokenVerified(true);
        setIsLoading(false);
      } catch (err: any) {
        console.error('Error verifying invitation:', err)
        setError(err.message || 'Invalid invitation. Please request a new invitation.')
        setIsLoading(false)
      }
    }
    
    checkSession()
  }, [searchParams])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Izvučemo parametre iz URL-a
    const token = searchParams?.get('token');
    const queryEmail = searchParams?.get('email');
    
    if (!token || !queryEmail) {
      setError('Invalid registration link. Missing token or email.');
      return;
    }
    
    if (!email || !fullName || !password) {
      setError('All fields are required')
      return
    }
    
    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }
    
    if (password.length < 8) {
      setError('Password must be at least 8 characters long')
      return
    }
    
    setIsLoading(true)
    setError(null)
    setMessage(null)
    
    try {
      console.log('Completing registration for:', email);
      
      // Koristimo admin API za kreiranje korisnika i validaciju tokena
      console.log('Using admin API to create user account');
      const response = await fetch(`/api/admin/create-user`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: queryEmail,
          password: password,
          fullName: fullName,
          phoneNumber: phoneNumber,
          token: token
        }),
      });
      
      const result = await response.json();
      console.log('Admin API result:', result);
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to create user account');
      }
      
      // Pokušaj prijavu sa novim kredencijalima
      console.log('Signing in with new credentials');
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: queryEmail,
        password: password,
      });
      
      if (signInError) {
        console.error('Error signing in with new credentials:', signInError);
        throw new Error('Failed to sign in with your new credentials. Please try logging in manually.');
      }
      
      console.log('Registration completed successfully!');
      setMessage('Registration completed successfully! Redirecting to dashboard...');
      
      // Redirect to dashboard
      setTimeout(() => {
        router.push('/dashboard');
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'Failed to complete registration. Please try again.');
      console.error('Error completing registration:', err);
      setIsLoading(false);
    }
  }

  if (isLoading) {
    return (
      <div className="h-[90svh] flex flex-col items-center justify-center bg-background px-4">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#FFB900] mb-4"></div>
        <p className="text-textPrimary">Verifying your registration link...</p>
      </div>
    )
  }

  if (error && !tokenVerified) {
    return (
      <div className="h-[90svh] flex flex-col items-center justify-center bg-background px-4">
        <div className="max-w-md w-full rounded-lg bg-inputBg p-8 shadow-lg text-center">
          <div className="text-red-500 text-5xl mb-4">⚠️</div>
          <h1 className="text-2xl font-bold text-textPrimary mb-4">Invalid Registration Link</h1>
          <p className="text-textSecondary mb-8">{error}</p>
          <button
            onClick={() => router.push('/login')}
            className="px-6 py-3 bg-[#FFB900] text-buttonText font-medium rounded-md transition-colors hover:bg-[#FFC933]"
          >
            Go to Login
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="h-[90svh] flex flex-col items-center justify-center bg-background px-4">
      <div className="max-w-md w-full rounded-lg bg-inputBg p-8 shadow-lg">
        <h1 className="text-2xl font-bold text-center text-textPrimary mb-6">
          Complete Registration
        </h1>
        
        {message && (
          <div className="mb-4 p-3 bg-green-100 border border-green-400 text-green-700 rounded">
            {message}
          </div>
        )}
        
        {error && (
          <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
            {error}
          </div>
        )}
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-textSecondary mb-2">
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-inputBorder rounded-md focus:outline-none focus:ring-2 focus:ring-[#FFB900] bg-inputBg text-textPrimary"
              placeholder="Enter your email"
              required
              disabled
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-textSecondary mb-2">
              Full Name
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full px-3 py-2 border border-inputBorder rounded-md focus:outline-none focus:ring-2 focus:ring-[#FFB900] bg-inputBg text-textPrimary"
              placeholder="Enter your full name"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-textSecondary mb-2">
              Phone Number (Optional)
            </label>
            <input
              type="tel"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              className="w-full px-3 py-2 border border-inputBorder rounded-md focus:outline-none focus:ring-2 focus:ring-[#FFB900] bg-inputBg text-textPrimary"
              placeholder="Enter your phone number"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-textSecondary mb-2">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-inputBorder rounded-md focus:outline-none focus:ring-2 focus:ring-[#FFB900] bg-inputBg text-textPrimary"
              placeholder="Enter your password"
              minLength={8}
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-textSecondary mb-2">
              Confirm Password
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-3 py-2 border border-inputBorder rounded-md focus:outline-none focus:ring-2 focus:ring-[#FFB900] bg-inputBg text-textPrimary"
              placeholder="Confirm your password"
              minLength={8}
              required
            />
          </div>
          
          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2 px-4 bg-[#FFB900] text-buttonText font-medium rounded-md hover:bg-[#FFC933] focus:outline-none focus:ring-2 focus:ring-[#FFB900] disabled:bg-[#FFB900]/50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Creating Account...' : 'Complete Registration'}
          </button>
        </form>
      </div>
    </div>
  )
} 

export default function CompleteRegistrationPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <CompleteRegistrationForm />
    </Suspense>
  );
}