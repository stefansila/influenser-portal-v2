'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { useAuth } from '../context/AuthContext'
import { useNotifications } from '../context/NotificationContext'
import { useChat } from '../context/ChatContext'
import { supabase } from '../lib/supabase'

const navigationItems = [
  { name: 'Dashboard', href: '/dashboard', icon: 'home' },
  { name: 'Old Proposals', href: '/dashboard/old-proposals', icon: 'proposal' },
  { name: 'Responses', href: '/dashboard/responses', icon: 'response' },
  { name: 'Chats', href: '/dashboard/chats', icon: 'chat' },
  { name: 'Notifications', href: '/dashboard/notifications', icon: 'notification' },
  { name: 'Settings', href: '/dashboard/settings', icon: 'settings' },
]

export default function Sidebar() {
  const pathname = usePathname()
  const { signOut, user } = useAuth()
  const { unreadCount: notificationUnreadCount } = useNotifications()
  const { unreadCount: chatUnreadCount } = useChat()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [userData, setUserData] = useState<any>(null)
  
  // Fetch user data
  useEffect(() => {
    const fetchUserData = async () => {
      if (!user) return
      
      try {
        const { data } = await supabase
          .from('users')
          .select('full_name, avatar_url')
          .eq('id', user.id)
          .single()
        
        setUserData(data)
      } catch (error) {
        console.error('Error fetching user data:', error)
      }
    }
    
    fetchUserData()
  }, [user])
  
  // Debug log for unread counts
  useEffect(() => {
    console.log('Sidebar chatUnreadCount:', chatUnreadCount);
  }, [chatUnreadCount]);
  
  // Close mobile menu when path changes
  useEffect(() => {
    setIsMobileMenuOpen(false)
  }, [pathname])
  
  const renderIcon = (icon: string) => {
    switch (icon) {
      case 'home':
        return (
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M8.15833 19.25V13.75H13.8417V19.25C13.8417 19.9375 14.4042 20.5 15.0917 20.5H19.525C20.2125 20.5 20.775 19.9375 20.775 19.25V10.5H22.8417C23.4225 10.5 23.7033 9.78334 23.2458 9.39167L12.5225 0.0458374C11.9417 -0.470829 11.0583 -0.470829 10.4775 0.0458374L-0.245833 9.39167C-0.72 9.78334 -0.42 10.5 0.158333 10.5H2.225V19.25C2.225 19.9375 2.7875 20.5 3.475 20.5H7.90833C8.59583 20.5 9.15833 19.9375 9.15833 19.25V13.75H14.8417" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )
      case 'proposal':
        return (
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M19.25 12.8333V5.5C19.25 3.61667 18.6517 2.75 16.5 2.75H14.6667C12.5149 2.75 11.9166 3.61667 11.9166 5.5V7.33333H8.25C6.09812 7.33333 5.49984 8.2 5.49984 10.0833V12.8333H2.74984V16.5C2.74984 18.3834 3.34811 19.25 5.49984 19.25H7.33317C9.4849 19.25 10.0832 18.3834 10.0832 16.5V10.0833C10.0832 8.2 9.4849 7.33333 7.33317 7.33333H5.49984V5.5C5.49984 3.61667 6.09812 2.75 8.25 2.75H16.5C18.6517 2.75 19.25 3.61667 19.25 5.5V12.8333H16.5V16.5C16.5 18.3834 17.0982 19.25 19.25 19.25H21.0833" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )
      case 'response':
        return (
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M7.33317 19.25H14.6665C17.4165 19.25 17.9765 17.8184 18.0932 16.5092L18.7332 9.17583C18.8865 7.60583 17.9582 6.41667 16.5015 6.41667H5.49817C4.04151 6.41667 3.11317 7.60583 3.26651 9.17583L3.90651 16.5092C4.0232 17.8184 4.58317 19.25 7.33317 19.25Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M7.33333 6.41667V5.5C7.33333 3.85833 7.33333 2.75 10.0833 2.75H11.9167C14.6667 2.75 14.6667 3.85833 14.6667 5.5V6.41667" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M11 15.5833V10.0833" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M8.25 12.8333L11 15.5833L13.75 12.8333" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )
      case 'chat':
        return (
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M19.25 10.5417C19.2531 11.7516 18.9701 12.9452 18.425 14.0417C17.7782 15.3192 16.7673 16.3909 15.5368 17.1518C14.3063 17.9128 12.9051 18.3328 11.4584 18.3333C10.2485 18.3365 9.05484 18.0535 7.95837 17.5083L2.75004 19.25L4.49171 14.0417C3.94651 12.9452 3.66351 11.7516 3.66671 10.5417C3.66722 9.09499 4.08722 7.69389 4.84819 6.46337C5.60916 5.23285 6.68084 4.22191 7.95837 3.57506C9.05484 3.02986 10.2485 2.74686 11.4584 2.75006H11.9167C13.8276 2.85555 15.6322 3.74522 16.9851 5.09812C18.338 6.45103 19.2277 8.25564 19.3334 10.1667V10.5417Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )
      case 'notification':
        return (
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M16.5 7.33333C16.5 5.91885 15.9381 4.56229 14.9379 3.5621C13.9377 2.5619 12.5812 2 11.1667 2C9.7522 2 8.39563 2.5619 7.39544 3.5621C6.39524 4.56229 5.83334 5.91885 5.83334 7.33333C5.83334 13.75 2.75 15.5833 2.75 15.5833H19.5833C19.5833 15.5833 16.5 13.75 16.5 7.33333Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M12.5969 19.25C12.4278 19.5278 12.1946 19.7584 11.9163 19.9191C11.6381 20.0798 11.3243 20.1651 11.0052 20.1651C10.6861 20.1651 10.3723 20.0798 10.0941 19.9191C9.81581 19.7584 9.58264 19.5278 9.41357 19.25" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )
      case 'settings':
        return (
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="11" cy="11" r="3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M18 11.2C18 10.8 17.9 10.4 17.8 10L19.7 8.5L17.7 5L15.6 6.1C15 5.6 14.3 5.2 13.5 5L13 2.8H9L8.5 5C7.7 5.2 7 5.6 6.4 6.1L4.3 5L2.3 8.5L4.2 10C4.1 10.4 4 10.8 4 11.2C4 11.6 4.1 12 4.2 12.4L2.3 13.9L4.3 17.4L6.4 16.3C7 16.8 7.7 17.2 8.5 17.4L9 19.6H13L13.5 17.4C14.3 17.2 15 16.8 15.6 16.3L17.7 17.4L19.7 13.9L17.8 12.4C17.9 12 18 11.6 18 11.2Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )
      default:
        return null
    }
  }

  // Pripremamo ime za prikaz
  const displayName = userData?.full_name || user?.email || 'User'
  // Pripremamo inicijal za avatar
  const avatarInitial = userData?.full_name 
    ? userData.full_name.charAt(0).toUpperCase() 
    : user?.email?.charAt(0).toUpperCase() || 'U'

  return (
    <>
      {/* Mobile header with menu toggle */}
      <div className="md:hidden flex items-center justify-between p-4 bg-background border-b border-white/10 sticky top-0 z-20">
        <div className="flex items-center">
          <Image 
            src="https://fbmdbvijfufsjpsuorxi.supabase.co/storage/v1/object/public/company-logos/logos/Vector.svg" 
            alt="Logo" 
            width={32} 
            height={32} 
            className="navbar-logo" 
          />
        </div>
        <button 
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="text-white p-2"
          aria-label="Toggle menu"
        >
          {isMobileMenuOpen ? (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          ) : (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M3 12H21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M3 6H21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M3 18H21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
        </button>
      </div>

      {/* Sidebar - hidden on mobile unless menu is open */}
      <div className={` 
        mobile-navbar fixed md:sticky top-0 left-0 z-10 h-full
        bg-[#080808] border-r border-white/10 
        transition-all duration-300 ease-in-out overflow-y-auto
        md:w-64 md:min-h-screen md:p-6 md:flex md:flex-col md:translate-x-0
        ${isMobileMenuOpen ? 'w-[85%] max-w-xs p-5 translate-x-0' : 'w-0 -translate-x-full'}
      `}>
        {/* Logo - hidden on mobile (shown in header) */}
        <div className="mb-10 hidden md:block">
          <Image 
            src="https://fbmdbvijfufsjpsuorxi.supabase.co/storage/v1/object/public/company-logos/logos/Vector.svg" 
            alt="Logo" 
            width={40} 
            height={40} 
            className="navbar-logo" 
          />
        </div>

        {/* Navigation */}
        <nav className={`space-y-3 flex-1 ${isMobileMenuOpen ? 'block' : 'hidden md:block'}`}>
          {navigationItems.map((item) => {
            const isActive = pathname === item.href
            return (
              <Link 
                key={item.name} 
                href={item.href}
                className={`flex items-center px-4 py-3 rounded-lg transition-colors ${
                  isActive 
                  ? 'text-[#FFB900] bg-white/5' 
                  : 'text-white/60 hover:text-white hover:bg-white/5'
                }`}
              >
                <span className={`mr-3 ${isActive ? 'text-[#FFB900]' : 'text-white/60'}`}>
                  {renderIcon(item.icon)}
                </span>
                <span className="text-sm md:text-base">{item.name}</span>
                {item.name === 'Notifications' && notificationUnreadCount > 0 && (
                  <span className="ml-auto bg-[#FFB900] text-black text-xs font-medium px-2 py-0.5 rounded-full">
                    {notificationUnreadCount > 99 ? '99+' : notificationUnreadCount}
                  </span>
                )}
                {item.name === 'Chats' && chatUnreadCount > 0 && (
                  <span className="ml-auto bg-[#FFB900] text-black text-xs font-medium px-2 py-0.5 rounded-full">
                    {chatUnreadCount > 99 ? '99+' : chatUnreadCount}
                  </span>
                )}
              </Link>
            )
          })}
        </nav>

        {/* User profile */}
        <div className={`mt-auto pt-5 border-t border-white/10 ${isMobileMenuOpen ? 'block' : 'hidden md:block'}`}>
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 md:w-10 md:h-10 bg-gray-700 rounded-full overflow-hidden flex items-center justify-center text-white">
              {userData?.avatar_url ? (
                <Image 
                  src={userData.avatar_url}
                  alt="User avatar"
                  width={40}
                  height={40}
                  className="object-cover w-full h-full"
                />
              ) : (
                <span>{avatarInitial}</span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">
                {displayName}
              </p>
            </div>
            <button 
              onClick={signOut}
              className="text-gray-400 hover:text-white"
              aria-label="Sign out"
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M7.5 17.5H4.16667C3.72464 17.5 3.30072 17.3244 2.98816 17.0118C2.67559 16.6993 2.5 16.2754 2.5 15.8333V4.16667C2.5 3.72464 2.67559 3.30072 2.98816 2.98816C3.30072 2.67559 3.72464 2.5 4.16667 2.5H7.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M13.3333 14.1667L17.5 10L13.3333 5.83334" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M17.5 10H7.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>
        </div>
      </div>
      
      {/* Mobile overlay to close sidebar when clicking outside */}
      {isMobileMenuOpen && (
        <div 
          className="md:hidden fixed inset-0 bg-black/70 z-0"
          onClick={() => setIsMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}
    </>
  )
} 