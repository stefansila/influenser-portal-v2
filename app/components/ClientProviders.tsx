'use client'

import { ReactNode } from 'react'
import { NotificationProvider } from '../context/NotificationContext'
import { ChatProvider } from '../context/ChatContext'
import ToastProvider from './ToastProvider'

export default function ClientProviders({ children }: { children: ReactNode }) {
  return (
    <NotificationProvider>
      <ChatProvider>
        <ToastProvider>
          {children}
        </ToastProvider>
      </ChatProvider>
    </NotificationProvider>
  )
} 