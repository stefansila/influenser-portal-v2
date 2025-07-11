'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import Image from 'next/image'
import { useRouter } from 'next/navigation'

export default function SettingsPage() {
  const { user, isLoading: authLoading } = useAuth()
  const [isLoading, setIsLoading] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [checkingAdmin, setCheckingAdmin] = useState(true)
  const router = useRouter()
  
  // Password change state
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  // Profile information state
  const [fullName, setFullName] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState('')

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
      } else {
        setCheckingAdmin(false)
      }
    }
    
    if (user && !authLoading) {
      checkAdminStatus()
    }
  }, [user, authLoading, router])

  // Use a memoized function to prevent unnecessary re-renders
  const fetchUserProfile = useCallback(async () => {
    if (!user) return
    
    try {
      const { data, error } = await supabase
        .from('users')
        .select('full_name, avatar_url')
        .eq('id', user.id)
        .single()
      
      if (error) {
        console.error('Error fetching user profile:', error)
        return
      }
      
      if (data) {
        setFullName(data.full_name || '')
        setAvatarUrl(data.avatar_url || '')
      }
    } catch (error) {
      console.error('Error fetching user profile:', error)
    }
  }, [user])

  useEffect(() => {
    if (user && !checkingAdmin) {
      fetchUserProfile()
    }
  }, [user, checkingAdmin, fetchUserProfile])

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    setAvatarFile(file)
    
    // Create preview URL
    const reader = new FileReader()
    reader.onloadend = () => {
      setAvatarPreview(reader.result as string)
    }
    reader.readAsDataURL(file)
  }

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!user) {
      setErrorMessage('User not authenticated')
      return
    }
    
    // Reset messages
    setSuccessMessage('')
    setErrorMessage('')
    setIsLoading(true)
    
    try {
      let updatedAvatarUrl = avatarUrl
      
      // If there's a new avatar file, upload it first
      if (avatarFile) {
        const fileExt = avatarFile.name.split('.').pop()
        const fileName = `${user?.id}-${Math.random()}.${fileExt}`
        const filePath = `${fileName}`
        
        // Upload the file to Supabase Storage
        const { error: uploadError, data: uploadData } = await supabase
          .storage
          .from('company-logos')
          .upload(filePath, avatarFile)
        
        if (uploadError) {
          console.error('Upload error:', uploadError)
          throw new Error('Failed to upload avatar: ' + uploadError.message)
        }
        
        // Get the public URL
        const { data } = supabase
          .storage
          .from('company-logos')
          .getPublicUrl(filePath)
        
        if (data && data.publicUrl) {
          updatedAvatarUrl = data.publicUrl
        } else {
          console.error('Failed to get public URL')
          throw new Error('Failed to get public URL for uploaded avatar')
        }
      }
      
      // Update the user profile in the database
      const { error: updateError } = await supabase
        .from('users')
        .update({
          full_name: fullName,
          avatar_url: updatedAvatarUrl,
        })
        .eq('id', user?.id)
      
      if (updateError) {
        console.error('Update error:', updateError)
        throw new Error('Failed to update profile: ' + updateError.message)
      }
      
      // Update local state
      setAvatarUrl(updatedAvatarUrl)
      setAvatarFile(null)
      setAvatarPreview('')
      setSuccessMessage('Profile updated successfully')
    } catch (error: any) {
      console.error('Profile update error:', error)
      setErrorMessage(error.message || 'Failed to update profile')
    } finally {
      setIsLoading(false)
    }
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!user) {
      setErrorMessage('User not authenticated')
      return
    }
    
    // Reset messages
    setSuccessMessage('')
    setErrorMessage('')
    
    // Validation
    if (newPassword !== confirmPassword) {
      setErrorMessage('New passwords do not match')
      return
    }
    
    if (newPassword.length < 6) {
      setErrorMessage('Password must be at least 6 characters long')
      return
    }
    
    setIsLoading(true)
    
    try {
      // First verify the current password
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email || '',
        password: currentPassword
      })
      
      if (signInError) {
        console.error('Current password verification failed:', signInError)
        throw new Error('Current password is incorrect')
      }
      
      // Then update the password
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      })
      
      if (error) {
        console.error('Password update error:', error)
        throw new Error('Failed to update password: ' + error.message)
      }
      
      // Clear the form fields
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      
      // Show success message and prepare for logout
      setSuccessMessage('Password updated successfully! You will be logged out in 3 seconds.')
      
      // Log user out after a delay - this is crucial as the session becomes invalid after password change
      setTimeout(async () => {
        try {
          await supabase.auth.signOut()
          router.push('/login?message=Password+changed+successfully.+Please+login+again+with+your+new+password.')
        } catch (error) {
          console.error('Error during logout after password change:', error)
          router.push('/login')
        }
      }, 3000)
    } catch (error: any) {
      console.error('Password change error:', error)
      setErrorMessage(error.message || 'Failed to update password')
    } finally {
      setIsLoading(false)
    }
  }

  if (authLoading || checkingAdmin) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#080808]">
        <div className="w-8 h-8 border-t-2 border-[#FFB900] rounded-full animate-spin"></div>
      </div>
    )
  }

  return (
    <div className="p-8 min-h-screen bg-background">
      {/* Header */}
      <div className="mb-12">
        <div className="space-y-2">
          <h1 className="text-4xl font-bold text-white">Settings</h1>
          <p className="text-gray-400">Manage your admin account settings</p>
        </div>
      </div>
      
      {/* Account Info */}
      <div className="mb-10">
        <h2 className="text-xl font-semibold text-white mb-4">Account Information</h2>
        <div className="bg-[#121212] border border-white/5 p-6">
          <div className="space-y-4">
            <div>
              <p className="text-sm text-[#FFB900]">Email</p>
              <p className="text-gray-300">{user?.email}</p>
            </div>
            <div>
              <p className="text-sm text-[#FFB900]">Role</p>
              <p className="text-gray-300 capitalize">Admin</p>
            </div>
          </div>
        </div>
      </div>
      
      {/* Profile Settings */}
      <div className="mb-10">
        <h2 className="text-xl font-semibold text-white mb-4">Profile Settings</h2>
        <div className="bg-[#121212] border border-white/5 p-6">
          <form onSubmit={handleProfileUpdate} className="space-y-6">
            {/* Success/Error messages */}
            {successMessage && (
              <div className="bg-green-500/10 border border-green-500/20 text-green-500 p-3 rounded">
                {successMessage}
              </div>
            )}
            {errorMessage && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-500 p-3 rounded">
                {errorMessage}
              </div>
            )}
            
            {/* Avatar upload */}
            <div>
              <label className="block text-white mb-2">Profile Picture</label>
              <div className="flex items-center space-x-4">
                <div className="relative w-16 h-16 rounded-full overflow-hidden bg-gray-700">
                  {(avatarPreview || avatarUrl) && (
                    <Image
                      src={avatarPreview || avatarUrl}
                      alt="Profile picture"
                      fill
                      className="object-cover"
                    />
                  )}
                </div>
                <label className="px-4 py-2 bg-[#1f1f1f] hover:bg-[#2a2a2a] text-white rounded cursor-pointer transition-colors">
                  Upload New
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarChange}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
            
            {/* Full Name */}
            <div>
              <label htmlFor="fullName" className="block text-white mb-2">
                Full Name
              </label>
              <input
                id="fullName"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full p-3 bg-[#1f1f1f] text-white border border-white/10 rounded focus:outline-none focus:ring-2 focus:ring-[#FFB900]/50"
                placeholder="Your full name"
              />
            </div>
            
            {/* Submit button */}
            <button
              type="submit"
              disabled={isLoading}
              className="px-6 py-3 bg-[#FFB900] hover:bg-[#e6a800] text-black font-medium rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Updating...' : 'Update Profile'}
            </button>
          </form>
        </div>
      </div>
      
      {/* Password Settings */}
      <div className="mb-10">
        <h2 className="text-xl font-semibold text-white mb-4">Password Settings</h2>
        <div className="bg-[#121212] border border-white/5 p-6">
          <form onSubmit={handleChangePassword} className="space-y-6">
            {/* Current Password */}
            <div>
              <label htmlFor="currentPassword" className="block text-white mb-2">
                Current Password
              </label>
              <input
                id="currentPassword"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full p-3 bg-[#1f1f1f] text-white border border-white/10 rounded focus:outline-none focus:ring-2 focus:ring-[#FFB900]/50"
                placeholder="Enter current password"
                required
              />
            </div>
            
            {/* New Password */}
            <div>
              <label htmlFor="newPassword" className="block text-white mb-2">
                New Password
              </label>
              <input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full p-3 bg-[#1f1f1f] text-white border border-white/10 rounded focus:outline-none focus:ring-2 focus:ring-[#FFB900]/50"
                placeholder="Enter new password"
                required
              />
            </div>
            
            {/* Confirm New Password */}
            <div>
              <label htmlFor="confirmPassword" className="block text-white mb-2">
                Confirm New Password
              </label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full p-3 bg-[#1f1f1f] text-white border border-white/10 rounded focus:outline-none focus:ring-2 focus:ring-[#FFB900]/50"
                placeholder="Confirm new password"
                required
              />
            </div>
            
            {/* Submit button */}
            <button
              type="submit"
              disabled={isLoading}
              className="px-6 py-3 bg-[#FFB900] hover:bg-[#e6a800] text-black font-medium rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Updating...' : 'Change Password'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
} 