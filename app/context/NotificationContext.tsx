'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

export type Notification = {
  id: string;
  recipient_id: string;
  title: string;
  message: string;
  type: 'info' | 'action' | 'popup';
  link_url: string | null;
  related_proposal_id: string | null;
  related_response_id: string | null;
  is_read: boolean;
  created_at: string;
};

type NotificationContextType = {
  notifications: Notification[];
  unreadCount: number;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  refreshNotifications: () => Promise<void>;
};

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  // Format notification link URLs correctly
  const formatNotificationLinks = (notification: Notification): Notification => {
    const { related_proposal_id, related_response_id } = notification;
    
    let link_url = notification.link_url;
    
    // Fix the proposal link format
    if (related_proposal_id && link_url?.includes('/dashboard/proposals/')) {
      link_url = `/dashboard/proposal/${related_proposal_id}`;
    }
    
    // Use view-response for response links
    if (related_response_id && link_url) {
      link_url = `/dashboard/view-response?id=${related_response_id}`;
    }
    
    return {
      ...notification,
      link_url
    };
  };

  const fetchNotifications = async () => {
    if (!user) return;
    
    try {
      console.log('NotificationContext: Fetching notifications for user:', user.id);
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('recipient_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);
      
      if (error) {
        console.error('Error fetching notifications:', error);
        return;
      }
      
      // Format links correctly for each notification
      const formattedData = data?.map(formatNotificationLinks) || [];
      setNotifications(formattedData);
      
      // Count unread notifications
      const unread = formattedData.filter(n => !n.is_read).length || 0;
      setUnreadCount(unread);
    } catch (error) {
      console.error('Error in fetchNotifications:', error);
    }
  };

  // Function to refresh notifications that can be called from outside
  const refreshNotifications = async () => {
    await fetchNotifications();
  };

  // Function to send notification email
  const sendNotificationEmail = async (notificationId: string) => {
    try {
      const response = await fetch('/api/notifications/send-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          notification_id: notificationId
        }),
      });

      const result = await response.json();
      
      if (response.ok) {
        console.log('Notification email sent successfully:', result);
      } else {
        console.error('Failed to send notification email:', result.error);
      }
    } catch (error) {
      console.error('Error sending notification email:', error);
    }
  };

  useEffect(() => {
    if (user) {
      fetchNotifications();
      
      // Set up realtime subscription for new notifications
      const subscription = supabase
        .channel('global:notifications')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `recipient_id=eq.${user.id}`
          },
          (payload) => {
            const newNotification = formatNotificationLinks(payload.new as Notification);
            setNotifications(prev => [newNotification, ...prev]);
            setUnreadCount(prev => prev + 1);
            
            // Automatically send email for new notifications
            sendNotificationEmail(newNotification.id);
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'notifications',
            filter: `recipient_id=eq.${user.id}`
          },
          (payload) => {
            const updatedNotification = formatNotificationLinks(payload.new as Notification);
            setNotifications(prev => 
              prev.map(n => n.id === updatedNotification.id ? updatedNotification : n)
            );
            
            // Recalculate unread count
            if (updatedNotification.is_read) {
              setUnreadCount(prev => Math.max(0, prev - 1));
            }
          }
        )
        .subscribe();
      
      return () => {
        subscription.unsubscribe();
      };
    }
  }, [user]);

  const markAsRead = async (id: string) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', id);
      
      if (error) {
        console.error('Error marking notification as read:', error);
        return;
      }
      
      // Update local state immediately
      setNotifications(prev => 
        prev.map(n => n.id === id ? { ...n, is_read: true } : n)
      );
      
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Error in markAsRead:', error);
    }
  };
  
  const markAllAsRead = async () => {
    if (!user || unreadCount === 0) return;
    
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('recipient_id', user.id)
        .eq('is_read', false);
      
      if (error) {
        console.error('Error marking all notifications as read:', error);
        return;
      }
      
      // Update local state immediately
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Error in markAllAsRead:', error);
    }
  };

  const value = {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    refreshNotifications,
  };

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}; 