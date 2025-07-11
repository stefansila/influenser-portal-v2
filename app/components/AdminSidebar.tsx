'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { useAuth } from '../context/AuthContext'
import { useAdminNotifications } from '../context/AdminNotificationContext'
import { useAdminChat } from '../context/AdminChatContext'
import { ProposalUnavailableMessage } from './UnavailableMessages'
import { supabase } from '../lib/supabase'

const navigationItems = [
  { name: 'Dashboard', href: '/admin', icon: 'home' },
  { name: 'Create Proposal', href: '/admin/create-proposal', icon: 'proposal' },
  { name: 'Old Proposals', href: '/admin/old-proposals', icon: 'proposal' },
  { name: 'Users', href: '/admin/users', icon: 'users' },
  { name: 'Send Invite', href: '/admin/send-invite', icon: 'response' },
  { name: 'Chats', href: '/admin/chats', icon: 'chat' },
  { name: 'Notifications', href: '/admin/notifications', icon: 'notification' },
  { name: 'Settings', href: '/admin/settings', icon: 'settings' },
]

export default function AdminSidebar() {
  const pathname = usePathname()
  const { signOut, user } = useAuth()
  const { unreadCount: notificationUnreadCount } = useAdminNotifications()
  const { unreadCount: chatUnreadCount } = useAdminChat()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [userData, setUserData] = useState<any>(null)
  
  // Fetch user data
  useEffect(() => {
    const fetchUserData = async () => {
      if (!user) return
      
      try {
        const { data } = await supabase
          .from('users')
          .select('full_name, avatar_url, role')
          .eq('id', user.id)
          .single()
        
        setUserData(data)
      } catch (error) {
        console.error('Error fetching user data:', error)
      }
    }
    
    fetchUserData()
  }, [user])
  
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
      case 'chat':
        return (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M21 11.5C21.0034 12.8199 20.6951 14.1219 20.1 15.3C19.3944 16.7118 18.3098 17.8992 16.9674 18.7293C15.6251 19.5594 14.0782 19.9994 12.5 20C11.1801 20.0035 9.87812 19.6951 8.7 19.1L3 21L4.9 15.3C4.30493 14.1219 3.99656 12.8199 4 11.5C4.00061 9.92176 4.44061 8.37488 5.27072 7.03258C6.10083 5.69028 7.28825 4.6056 8.7 3.90003C9.87812 3.30496 11.1801 2.99659 12.5 3.00003H13C15.0843 3.11502 17.053 3.99479 18.5291 5.47089C20.0052 6.94699 20.885 8.91568 21 11V11.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
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
      case 'notification':
        return (
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M16.5 7.33333C16.5 5.91885 15.9205 4.56229 14.8891 3.5309C13.8577 2.4995 12.5012 1.91667 11.0867 1.91667C9.67222 1.91667 8.31566 2.4995 7.28427 3.5309C6.25287 4.56229 5.67004 5.91885 5.67004 7.33333C5.67004 13.75 2.75337 15.5833 2.75337 15.5833H19.42C19.42 15.5833 16.5 13.75 16.5 7.33333Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M12.6908 19.25C12.5358 19.5066 12.3128 19.7194 12.0426 19.8654C11.7724 20.0115 11.464 20.0853 11.1505 20.0796C10.837 20.0739 10.5317 19.9889 10.2676 19.8329C10.0035 19.6769 9.78839 19.4558 9.64337 19.1933" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )
      case 'users':
        return (
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M16.5 19.25V17.4167C16.5 16.4442 16.1136 15.5116 15.4259 14.8241C14.7384 14.1366 13.8058 13.75 12.8333 13.75H5.5C4.52754 13.75 3.59492 14.1366 2.90741 14.8241C2.21991 15.5116 1.83333 16.4442 1.83333 17.4167V19.25" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M9.16667 10.0833C11.1917 10.0833 12.8333 8.44171 12.8333 6.41667C12.8333 4.39162 11.1917 2.75 9.16667 2.75C7.14162 2.75 5.5 4.39162 5.5 6.41667C5.5 8.44171 7.14162 10.0833 9.16667 10.0833Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M20.1667 19.25V17.4167C20.1661 16.6493 19.9204 15.9026 19.4672 15.2956C19.014 14.6886 18.3772 14.2534 17.6458 14.0542" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M14.6667 3.05417C15.4003 3.25298 16.0393 3.68956 16.4939 4.29826C16.9485 4.90696 17.1949 5.65632 17.1949 6.42584C17.1949 7.19535 16.9485 7.94471 16.4939 8.55341C16.0393 9.16211 15.4003 9.59869 14.6667 9.7975" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
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

  // Pripremamo ime za prikaz i avatar
  const displayName = userData?.full_name || user?.email || 'Admin'
  // Pripremamo inicijal za avatar
  const avatarInitial = userData?.full_name 
    ? userData.full_name.charAt(0).toUpperCase() 
    : user?.email?.charAt(0).toUpperCase() || 'A'

  if (!userData) {
    return <ProposalUnavailableMessage />;
  }

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
          <span className="ml-2 text-xs text-[#FFB900]">Admin</span>
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
        fixed md:sticky top-0 left-0 z-10 h-full
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
            const isNotification = item.name === 'Notifications'
            const isChat = item.name === 'Chats'
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
                <span className="text-sm md:text-base flex-1">{item.name}</span>
                {isNotification && notificationUnreadCount > 0 && (
                  <span className="flex items-center justify-center h-5 min-w-5 px-1 text-xs font-medium rounded-full bg-[#FFB900] text-black">
                    {notificationUnreadCount > 99 ? '99+' : notificationUnreadCount}
                  </span>
                )}
                {isChat && chatUnreadCount > 0 && (
                  <span className="flex items-center justify-center h-5 min-w-5 px-1 text-xs font-medium rounded-full bg-[#FFB900] text-black">
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
            <div className="w-8 h-8 md:w-10 md:h-10 bg-gray-700 rounded-full flex items-center justify-center text-white">
              {userData?.avatar_url ? (
                <Image 
                  src={userData.avatar_url}
                  alt="Admin avatar"
                  width={40}
                  height={40}
                  className="object-cover w-full h-full rounded-full"
                />
              ) : (
                <span>{avatarInitial}</span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">
                {displayName}
              </p>
              <p className="text-xs text-[#FFB900]">Admin</p>
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