'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAdminNotifications } from '../../context/AdminNotificationContext'

export default function AdminNotifications() {
  const router = useRouter()
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useAdminNotifications()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(false)
  }, [notifications])
  
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date)
  }
  
  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'action':
        return (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-[#FFB900]">
            <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M12 16V12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M12 8H12.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )
      case 'warning':
        return (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-orange-500">
            <path d="M10.29 3.86L1.82 18C1.64 18.32 1.55 18.7 1.56 19.09C1.57 19.47 1.68 19.85 1.88 20.17C2.08 20.5 2.36 20.75 2.7 20.91C3.03 21.07 3.4 21.13 3.77 21.07H20.23C20.6 21.13 20.97 21.07 21.3 20.91C21.64 20.75 21.92 20.5 22.12 20.17C22.32 19.85 22.43 19.47 22.44 19.09C22.45 18.7 22.36 18.32 22.18 18L13.71 3.86C13.52 3.56 13.26 3.32 12.95 3.17C12.64 3.02 12.3 2.95 11.95 2.98C11.6 3 11.27 3.12 10.97 3.32C10.68 3.52 10.44 3.79 10.29 4.12V3.86Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M12 17H12.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M12 9V13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )
      default: // info
        return (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-blue-500">
            <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M12 16V12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M12 8H12.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )
    }
  }
  
  const handleNotificationClick = async (notification: any) => {
    // Mark as read first
    if (!notification.is_read) {
      await markAsRead(notification.id)
    }
    
    console.log('Notification clicked:', {
      id: notification.id,
      proposalId: notification.related_proposal_id,
      responseId: notification.related_response_id,
      link: notification.link_url
    })
    
    // Determine where to navigate
    if (notification.link_url) {
      // Use the link_url as first priority if it exists
      router.push(notification.link_url)
    } else if (notification.related_response_id) {
      // If only response is related, navigate to the response detail page
      router.push(`/admin/response/${notification.related_response_id}`)
    } else if (notification.related_proposal_id) {
      // If only proposal is related, navigate to the proposal
      router.push(`/admin/proposal/${notification.related_proposal_id}`)
    }
  }
  
  return (
    <div className="p-10 max-w-4xl mx-auto">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-3xl font-bold text-white">Notifications</h1>
        
        {unreadCount > 0 && (
          <button 
            onClick={markAllAsRead}
            className="text-sm text-[#FFB900] hover:underline"
          >
            Mark all as read
          </button>
        )}
      </div>
      
      {loading ? (
        <div className="flex items-center justify-center h-60">
          <div className="w-8 h-8 border-t-2 border-[#FFB900] rounded-full animate-spin"></div>
        </div>
      ) : notifications.length > 0 ? (
        <div className="space-y-4">
          {notifications.map((notification) => (
            <div 
              key={notification.id} 
              className={`p-5 rounded-lg border cursor-pointer ${
                notification.is_read 
                  ? 'bg-[#121212] border-white/5 hover:bg-[#181818]' 
                  : 'bg-[#18170F] border-[#FFB900]/20 hover:bg-[#1D1C14]'
              }`}
              onClick={() => handleNotificationClick(notification)}
            >
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 mt-1">
                  {getNotificationIcon(notification.type)}
                </div>
                <div className="flex-grow">
                  <div className="flex justify-between items-start mb-1">
                    <h3 className={`font-medium ${notification.is_read ? 'text-white' : 'text-[#FFB900]'}`}>
                      {notification.title}
                    </h3>
                    <span className="text-xs text-gray-400">
                      {formatDate(notification.created_at)}
                    </span>
                  </div>
                  <p className="text-sm text-gray-300 mb-3">{notification.message}</p>
                  
                  <div className="flex justify-between items-center mt-2">
                    {(notification.link_url || notification.related_proposal_id) && (
                      <span className="text-sm text-[#FFB900] hover:underline">
                        View details
                      </span>
                    )}
                    
                    {!notification.is_read && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          markAsRead(notification.id);
                        }}
                        className="text-xs text-gray-400 hover:text-white"
                      >
                        Mark as read
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-[#121212] border border-white/5 rounded-lg p-8 text-center">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="mx-auto mb-4 text-gray-500">
            <path d="M18 8C18 6.4087 17.3679 4.88258 16.2426 3.75736C15.1174 2.63214 13.5913 2 12 2C10.4087 2 8.88258 2.63214 7.75736 3.75736C6.63214 4.88258 6 6.4087 6 8C6 15 3 17 3 17H21C21 17 18 15 18 8Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M13.73 21C13.5542 21.3031 13.3019 21.5547 12.9982 21.7295C12.6946 21.9044 12.3504 21.9965 12 21.9965C11.6496 21.9965 11.3054 21.9044 11.0018 21.7295C10.6982 21.5547 10.4458 21.3031 10.27 21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <p className="text-gray-400">You don't have any notifications yet</p>
        </div>
      )}
    </div>
  )
} 