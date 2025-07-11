'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { useNotifications } from '../../context/NotificationContext'

export default function NotificationsPage() {
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications()

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      hour: '2-digit', 
      minute: '2-digit' 
    })
  }
  
  const getNotificationTime = (dateString: string) => {
    const now = new Date()
    const notificationDate = new Date(dateString)
    const diffMs = now.getTime() - notificationDate.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    
    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins} min${diffMins === 1 ? '' : 's'} ago`
    
    const diffHours = Math.floor(diffMins / 60)
    if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`
    
    const diffDays = Math.floor(diffHours / 24)
    if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`
    
    return formatDate(dateString)
  }

  if (!notifications) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="w-8 h-8 border-t-2 border-[#FFB900] rounded-full animate-spin"></div>
      </div>
    )
  }

  return (
    <div className="p-8 min-h-screen bg-background">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <h1 className="text-4xl font-bold text-white">Notifications</h1>
          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              className="text-sm text-[#FFB900] hover:underline"
            >
              Mark all as read
            </button>
          )}
        </div>
        <p className="text-gray-400 mt-2">Stay updated with the latest activities</p>
      </div>

      {/* Notifications List */}
      <div className="space-y-4">
        {notifications.length === 0 ? (
          <div className="bg-[#121212] border border-white/5 p-8 text-center">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="mx-auto mb-4 text-gray-500">
              <path d="M18 8C18 6.4087 17.3679 4.88258 16.2426 3.75736C15.1174 2.63214 13.5913 2 12 2C10.4087 2 8.88258 2.63214 7.75736 3.75736C6.63214 4.88258 6 6.4087 6 8C6 15 3 17 3 17H21C21 17 18 15 18 8Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M13.73 21C13.5542 21.3031 13.3019 21.5547 12.9982 21.7295C12.6946 21.9044 12.3504 21.9965 12 21.9965C11.6496 21.9965 11.3054 21.9044 11.0018 21.7295C10.6982 21.5547 10.4458 21.3031 10.27 21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <p className="text-gray-300">You don't have any notifications yet.</p>
          </div>
        ) : (
          notifications.map((notification) => (
            <div 
              key={notification.id} 
              className={`bg-[#121212] border border-white/5 p-6 ${!notification.is_read ? 'border-l-[3px] border-l-[#FFB900]' : ''}`}
            >
              <div className="flex justify-between">
                <div className="flex-grow">
                  <h3 className={`text-lg font-semibold ${!notification.is_read ? 'text-[#FFB900]' : 'text-white'}`}>
                    {notification.title}
                  </h3>
                  <p className="text-gray-300 mt-2">{notification.message}</p>
                  
                  <div className="mt-4 flex items-center space-x-4">
                    <span className="text-sm text-gray-400">
                      {getNotificationTime(notification.created_at)}
                    </span>
                    
                    {notification.link_url && (
                      <Link 
                        href={notification.link_url} 
                        className="text-sm text-[#FFB900] hover:underline"
                        onClick={() => markAsRead(notification.id)}
                      >
                        View Details
                      </Link>
                    )}
                    
                    {!notification.is_read && (
                      <button 
                        onClick={() => markAsRead(notification.id)}
                        className="text-sm text-gray-400 hover:text-white"
                      >
                        Mark as Read
                      </button>
                    )}
                  </div>
                </div>
                
                <div className="flex-shrink-0">
                  {notification.type === 'info' && (
                    <div className="w-10 h-10 flex items-center justify-center bg-blue-900/20 text-blue-400 rounded-full">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M12 16V12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M12 8H12.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                  )}
                  
                  {notification.type === 'action' && (
                    <div className="w-10 h-10 flex items-center justify-center bg-amber-900/20 text-[#FFB900] rounded-full">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M10.29 3.86L1.82 18C1.64 18.32 1.56 18.7 1.58 19.08C1.6 19.46 1.73 19.82 1.95 20.12C2.17 20.42 2.47 20.66 2.82 20.79C3.16 20.93 3.54 20.95 3.9 20.87L12 18.69L20.1 20.87C20.46 20.95 20.84 20.93 21.18 20.79C21.53 20.66 21.83 20.42 22.05 20.12C22.27 19.82 22.4 19.46 22.42 19.08C22.44 18.7 22.36 18.32 22.18 18L13.71 3.86C13.55 3.57 13.3 3.33 13 3.16C12.7 2.99 12.36 2.9 12 2.9C11.64 2.9 11.3 2.99 11 3.16C10.7 3.33 10.45 3.57 10.29 3.86Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                  )}
                  
                  {notification.type === 'popup' && (
                    <div className="w-10 h-10 flex items-center justify-center bg-purple-900/20 text-purple-400 rounded-full">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M18 8C18 6.4087 17.3679 4.88258 16.2426 3.75736C15.1174 2.63214 13.5913 2 12 2C10.4087 2 8.88258 2.63214 7.75736 3.75736C6.63214 4.88258 6 6.4087 6 8C6 15 3 17 3 17H21C21 17 18 15 18 8Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M13.73 21C13.5542 21.3031 13.3019 21.5547 12.9982 21.7295C12.6946 21.9044 12.3504 21.9965 12 21.9965C11.6496 21.9965 11.3054 21.9044 11.0018 21.7295C10.6982 21.5547 10.4458 21.3031 10.27 21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
} 