'use client';

import { AuthProvider } from '../context/AuthContext';
import { NotificationProvider } from '../context/NotificationContext';
import { ChatProvider } from '../context/ChatContext';
import ToastProvider from './ToastProvider';

export default function AuthProviderClient({ 
  children 
}: { 
  children: React.ReactNode 
}) {
  return (
    <AuthProvider>
      <NotificationProvider>
        <ChatProvider>
          <ToastProvider>
            {children}
          </ToastProvider>
        </ChatProvider>
      </NotificationProvider>
    </AuthProvider>
  );
} 