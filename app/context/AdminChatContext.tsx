'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

type AdminChatContextType = {
  unreadCount: number;
  markMessagesAsRead: (chatId: string) => Promise<void>;
  markAllMessagesAsRead: () => Promise<void>;
};

const AdminChatContext = createContext<AdminChatContextType>({
  unreadCount: 0,
  markMessagesAsRead: async () => {},
  markAllMessagesAsRead: async () => {},
});

export const useAdminChat = () => useContext(AdminChatContext);

export const AdminChatProvider = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  
  // Function to fetch unread count that can be reused - memoized with useCallback
  const fetchUnreadCount = useCallback(async (activeChatId?: string) => {
    if (!user) return;
    
    try {
      // Get all proposals created by this admin
      const { data: adminProposals, error: proposalsError } = await supabase
        .from('proposals')
        .select('id')
        .eq('created_by', user.id);
      
      if (proposalsError) {
        console.error('Error fetching admin proposals:', proposalsError);
        return;
      }
      
      if (!adminProposals || adminProposals.length === 0) {
        setUnreadCount(0);
        return;
      }
      
      // Get the proposal IDs
      const proposalIds = adminProposals.map(p => p.id);
      
      // Get unread messages from chats linked to admin's proposals
      const { data, error } = await supabase
        .from('chat_messages')
        .select(`
          id,
          chat:chats!inner(
            proposal_id
          )
        `)
        .eq('is_read', false)
        .neq('user_id', user.id)
        .in('chats.proposal_id', proposalIds);
      
      if (error) {
        console.error('Error fetching admin unread chat count:', error);
        return;
      }
      
      const globalUnreadCount = data?.length || 0;
      
      // Only update if we're not in an active chat, or if the count is different
      if (!activeChatId || globalUnreadCount !== unreadCount) {
        setUnreadCount(globalUnreadCount);
        console.log('Admin unread messages count:', globalUnreadCount);
      }
    } catch (err) {
      console.error('Error fetching admin unread chat count:', err);
    }
  }, [user, unreadCount]); // Include unreadCount to prevent unnecessary updates
  
  // Function to mark messages as read in a specific chat
  const markMessagesAsRead = useCallback(async (chatId: string) => {
    if (!user || !chatId) return;
    
    try {
      // Mark all unread messages in this chat as read (not sent by admin)
      const { error } = await supabase
        .from('chat_messages')
        .update({ is_read: true })
        .eq('chat_id', chatId)
        .eq('is_read', false)
        .neq('user_id', user.id);
      
      if (error) {
        console.error('Error marking messages as read:', error);
        return;
      }
      
      console.log('Admin marked messages as read for chat:', chatId);
      
      // Update the global unread count
      fetchUnreadCount();
      
    } catch (err) {
      console.error('Error marking messages as read:', err);
    }
  }, [user, fetchUnreadCount]);
  
  // Function to mark all messages as read across all chats
  const markAllMessagesAsRead = useCallback(async () => {
    if (!user) return;
    
    try {
      // Get all proposals created by this admin
      const { data: adminProposals, error: proposalsError } = await supabase
        .from('proposals')
        .select('id')
        .eq('created_by', user.id);
      
      if (proposalsError) {
        console.error('Error fetching admin proposals:', proposalsError);
        return;
      }
      
      if (!adminProposals || adminProposals.length === 0) {
        return;
      }
      
      const proposalIds = adminProposals.map(p => p.id);
      
      // First get all chat IDs for admin's proposals
      const { data: adminChats, error: chatsError } = await supabase
        .from('chats')
        .select('id')
        .in('proposal_id', proposalIds);
      
      if (chatsError) {
        console.error('Error fetching admin chats:', chatsError);
        return;
      }
      
      if (!adminChats || adminChats.length === 0) {
        return;
      }
      
      const chatIds = adminChats.map(c => c.id);
      
      // Mark all unread messages as read for all chats related to admin's proposals
      const { error } = await supabase
        .from('chat_messages')
        .update({ is_read: true })
        .eq('is_read', false)
        .neq('user_id', user.id)
        .in('chat_id', chatIds);
      
      if (error) {
        console.error('Error marking all messages as read:', error);
        return;
      }
      
      console.log('Admin marked all messages as read');
      
      // Reset unread count
      setUnreadCount(0);
      
    } catch (err) {
      console.error('Error marking all messages as read:', err);
    }
  }, [user]);
  
  // Auto-mark messages as read when viewing a chat (instantly)
  const autoMarkAsRead = useCallback((chatId: string) => {
    // Mark as read immediately (no delay)
    markMessagesAsRead(chatId);
  }, [markMessagesAsRead]);
  
  // Track overall unread message count across all chats for admin
  useEffect(() => {
    if (!user) return;
    
    let isSubscribed = true;
    
    // Initial fetch
    fetchUnreadCount();
    
    // Subscribe to changes in the chat_messages table for all messages
    const subscription = supabase
      .channel('admin_unread_messages_global')
      .on('postgres_changes', {
        event: '*', // Listen for all events
        schema: 'public',
        table: 'chat_messages',
      }, () => {
        // Refetch the unread count when any change happens
        if (isSubscribed) {
          fetchUnreadCount();
        }
      })
      .subscribe();
    
    return () => {
      isSubscribed = false;
      subscription.unsubscribe();
    };
  }, [user, fetchUnreadCount]);

  return (
    <AdminChatContext.Provider value={{ 
      unreadCount, 
      markMessagesAsRead, 
      markAllMessagesAsRead 
    }}>
      {children}
    </AdminChatContext.Provider>
  );
}; 