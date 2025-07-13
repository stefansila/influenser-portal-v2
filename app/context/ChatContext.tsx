'use client';

import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

export type ChatMessage = {
  id: string;
  chat_id: string;
  user_id: string;
  message: string;
  created_at: string;
  is_read: boolean;
  attachment_url?: string;
  file_name?: string;
  user?: {
    full_name: string | null;
    email: string | null;
  };
};

type ChatContextType = {
  chatId: string | null;
  messages: ChatMessage[];
  loading: boolean;
  error: string | null;
  sendMessage: (message: string, attachmentUrl?: string, fileName?: string) => Promise<void>;
  setChatProposalId: (proposalId: string) => Promise<void>;
  markMessagesAsRead: () => Promise<void>;
  unreadCount: number;
  isTyping: boolean;
  sendTypingIndicator: () => void;
};

const ChatContext = createContext<ChatContextType>({
  chatId: null,
  messages: [],
  loading: false,
  error: null,
  sendMessage: async () => {},
  setChatProposalId: async () => {},
  markMessagesAsRead: async () => {},
  unreadCount: 0,
  isTyping: false,
  sendTypingIndicator: () => {},
});

export const useChat = () => useContext(ChatContext);

export const ChatProvider = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  const [chatId, setChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [currentProposalId, setCurrentProposalId] = useState<string | null>(null);
  const [isTyping, setIsTyping] = useState<boolean>(false);
  
  // Refs for managing subscriptions and timeouts
  const realtimeChannelRef = useRef<any>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const markAsReadTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const fetchChat = async (proposalId: string) => {
    if (!user || !proposalId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      // Find or create a chat for this user and proposal
      const { data: existingChat, error: chatError } = await supabase
        .from('chats')
        .select('id')
        .eq('proposal_id', proposalId)
        .eq('user_id', user.id)
        .single();
        
      if (chatError && chatError.code !== 'PGRST116') {
        console.error('Error fetching chat:', chatError);
        setError('Failed to load chat');
        setLoading(false);
        return;
      }
      
      let currentChatId = existingChat?.id;
      
      // If no chat exists, create one
      if (!currentChatId) {
        const { data: newChat, error: createError } = await supabase
          .from('chats')
          .insert({
            proposal_id: proposalId,
            user_id: user.id
          })
          .select('id')
          .single();
          
        if (createError) {
          console.error('Error creating chat:', createError);
          setError('Failed to create chat');
          setLoading(false);
          return;
        }
        
        currentChatId = newChat.id;
      }
      
      setChatId(currentChatId);
      setCurrentProposalId(proposalId);
      await fetchMessages(currentChatId);
      
    } catch (err: any) {
      console.error('Chat fetch error:', err);
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };
  
  const fetchMessages = async (chatId: string) => {
    if (!user || !chatId) return;
    
    try {
      // First verify this chat belongs to the current user
      const { data: chatData, error: chatError } = await supabase
        .from('chats')
        .select('id, user_id, proposal_id')
        .eq('id', chatId)
        .single();
      
      if (chatError) {
        console.error('Error verifying chat ownership:', chatError);
        setError('Failed to load messages: chat not found');
        return;
      }
      
      // Double check chat ownership - this is a failsafe beyond RLS
      if (chatData.user_id !== user.id) {
        // Check if user is the admin of this proposal
        const { data: proposalData, error: proposalError } = await supabase
          .from('proposals')
          .select('created_by')
          .eq('id', chatData.proposal_id)
          .single();
        
        if (proposalError || proposalData.created_by !== user.id) {
          console.error('Unauthorized attempt to access chat:', chatId);
          setError('Unauthorized: You do not have permission to view this chat');
          return;
        }
      }
      
      // Use the view instead of joining tables directly
      const { data: messagesData, error: messagesError } = await supabase
        .from('chat_messages_with_users')
        .select(`
          id,
          chat_id,
          user_id,
          message,
          created_at,
          is_read,
          attachment_url,
          file_name,
          full_name,
          email
        `)
        .eq('chat_id', chatId)
        .order('created_at', { ascending: true });
      
      if (messagesError) {
        console.error('Error fetching messages:', messagesError);
        setError('Failed to load messages');
        return;
      }
      
      // Format the messages to match our expected structure
      const formattedMessages = messagesData.map((msg: any) => ({
        id: msg.id,
        chat_id: msg.chat_id,
        user_id: msg.user_id,
        message: msg.message,
        created_at: msg.created_at,
        is_read: msg.is_read,
        attachment_url: msg.attachment_url,
        file_name: msg.file_name,
        user: {
          full_name: msg.full_name,
          email: msg.email
        }
      }));
      
      setMessages(formattedMessages);
      
      // Count unread messages (not sent by the current user)
      const unread = formattedMessages.filter(
        msg => !msg.is_read && msg.user_id !== user.id
      ).length;
      
      setUnreadCount(unread);
      
      // Don't automatically mark messages as read - let user chat page handle this
      // when user actually opens the chat page
      
    } catch (err: any) {
      console.error('Messages fetch error:', err);
      setError(err.message || 'An error occurred');
    }
  };
  
  const setChatProposalId = async (proposalId: string) => {
    // Skip if already loaded for this proposal
    if (proposalId === currentProposalId && chatId) {
      console.log('Chat already set for proposal:', proposalId);
      return;
    }
    
    await fetchChat(proposalId);
  };
  
  const sendMessage = async (message: string, attachmentUrl?: string, fileName?: string) => {
    if (!user || !chatId) return;
    
    try {
      // First verify this chat exists and belongs to the current user
      const { data: chatData, error: chatError } = await supabase
        .from('chats')
        .select('id, user_id, proposal_id')
        .eq('id', chatId)
        .single();
      
      if (chatError) {
        console.error('Error verifying chat for sending message:', chatError);
        setError('Failed to send message: chat not found');
        throw new Error('Chat not found');
      }
      
      // Prepare the new message
      const newMessage = {
        chat_id: chatId,
        user_id: user.id,
        message,
        is_read: false,
        attachment_url: attachmentUrl || null,
        file_name: fileName || null,
      };
      
      // Create optimistic message with temporary ID for immediate UI update
      const tempId = `temp-${Date.now()}`;
      const optimisticMessage: ChatMessage = {
        id: tempId,
        chat_id: chatId,
        user_id: user.id,
        message,
        created_at: new Date().toISOString(),
        is_read: false,
        attachment_url: attachmentUrl,
        file_name: fileName,
        user: {
          full_name: user.user_metadata?.full_name || null,
          email: user.email || null
        }
      };
      
      // Add optimistic message to UI immediately
      console.log('Adding optimistic message to UI immediately:', optimisticMessage);
      setMessages(prevMessages => [...prevMessages, optimisticMessage]);
      
      // Send message to server
      const { data, error } = await supabase
        .from('chat_messages')
        .insert(newMessage)
        .select('id, created_at')
        .single();
      
      if (error) {
        console.error('Error sending message:', error);
        // Remove optimistic message on error
        setMessages(prevMessages => prevMessages.filter(msg => msg.id !== tempId));
        setError('Failed to send message');
        throw new Error('Failed to send message');
      }
      
      // Update the optimistic message with the real ID and timestamp
      setMessages(prevMessages => 
        prevMessages.map(msg => 
          msg.id === tempId 
            ? { ...msg, id: data.id, created_at: data.created_at }
            : msg
        )
      );
      
      console.log('Message sent successfully:', data);
      
    } catch (err: any) {
      console.error('Send message error:', err);
      setError(err.message || 'Failed to send message');
      throw err;
    }
  };
  
  const markMessagesAsRead = async () => {
    if (!user || !chatId) return;
    
    try {
      // Mark all unread messages in this chat as read
      const { error } = await supabase
        .from('chat_messages')
        .update({ is_read: true })
        .eq('chat_id', chatId)
        .eq('is_read', false)
        .neq('user_id', user.id); // Don't mark own messages as read
      
      if (error) {
        console.error('Error marking messages as read:', error);
        return;
      }
      
      // Update local state
      setMessages(prevMessages => 
        prevMessages.map(msg => 
          msg.user_id !== user.id ? { ...msg, is_read: true } : msg
        )
      );
      
      // Reset unread count for this chat
      setUnreadCount(0);
      
      // Refresh global unread count
      fetchGlobalUnreadCount();
      
      console.log('Messages marked as read for chat:', chatId);
      
    } catch (err: any) {
      console.error('Mark as read error:', err);
    }
  };
  
  const fetchGlobalUnreadCount = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .select(`
          id,
          chat:chats!inner(
            user_id
          )
        `)
        .eq('is_read', false)
        .neq('user_id', user.id)
        .eq('chats.user_id', user.id);
      
      if (error) {
        console.error('Error fetching unread count:', error);
        return;
      }
      
      const globalUnreadCount = data?.length || 0;
      
      // Only update if we're not in an active chat, or if the count is different
      if (!chatId || globalUnreadCount !== unreadCount) {
        setUnreadCount(globalUnreadCount);
        console.log('Updated global unread message count:', globalUnreadCount);
      }
    } catch (err) {
      console.error('Error fetching unread count:', err);
    }
  };

  const sendTypingIndicator = () => {
    if (!chatId || !user || !realtimeChannelRef.current) return;
    
    // Send typing indicator via existing realtime channel
    realtimeChannelRef.current.send({
      type: 'broadcast',
      event: 'typing',
      payload: { 
        userId: user.id,
        userName: user.user_metadata?.full_name || user.email,
        timestamp: Date.now()
      }
    });
  };

  // Set up real-time subscriptions when chatId changes
  useEffect(() => {
    if (!chatId || !user) return;
    
    console.log('Setting up real-time subscription for chat:', chatId);
    
    // Clean up previous subscription
    if (realtimeChannelRef.current) {
      supabase.removeChannel(realtimeChannelRef.current);
    }
    
    // Create a consistent channel name for this chat
    const channelName = `chat-${chatId}`;
    console.log('Creating channel:', channelName);
    
    // Track known message IDs to prevent duplicates
    const knownMessageIds = new Set(messages.map(msg => msg.id));
    
    // Subscribe to new messages and typing indicators
    const channel = supabase.channel(channelName);
    
    channel
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_messages',
        filter: `chat_id=eq.${chatId}`,
      }, async (payload: any) => {
        console.log('Received new message via postgres_changes:', payload);
        
        // Skip if message already known (possibly from optimistic update)
        if (knownMessageIds.has(payload.new.id)) {
          console.log('Message already known, skipping:', payload.new.id);
          return;
        }
        
        // Skip if message was sent by current user (already handled by optimistic update)
        if (payload.new.user_id === user?.id) {
          console.log('Skipping subscription update for own message');
          return;
        }
        
        try {
          // Fetch user data for the message
          const { data: userData, error: userError } = await supabase
            .from('users')
            .select('full_name, email')
            .eq('id', payload.new.user_id)
            .single();
          
          if (userError) {
            console.error('Error fetching user data for new message:', userError);
          }
          
          // Create a complete message object
          const newMessage: ChatMessage = {
            id: payload.new.id,
            chat_id: payload.new.chat_id,
            user_id: payload.new.user_id,
            message: payload.new.message,
            created_at: payload.new.created_at,
            is_read: payload.new.is_read,
            attachment_url: payload.new.attachment_url,
            file_name: payload.new.file_name,
            user: userData || { full_name: null, email: null },
          };
          
          // Add message ID to known set
          knownMessageIds.add(newMessage.id);
          
          console.log('Adding new message to state:', newMessage);
          
          // Add the new message to state
          setMessages(prevMessages => {
            // Check for duplicates
            if (prevMessages.some(msg => msg.id === newMessage.id)) {
              console.log('Message already exists, skipping:', newMessage.id);
              return prevMessages;
            }
            
            console.log('New message added to state:', newMessage.id);
            return [...prevMessages, newMessage];
          });
          
          // Don't automatically mark messages as read - let user chat page handle this
          // when user actually opens the chat page
          
        } catch (error) {
          console.error('Error processing new message:', error);
        }
      })
      .on('broadcast', { event: 'typing' }, (payload) => {
        // Handle typing indicators
        if (payload.payload.userId !== user.id) {
          setIsTyping(true);
          
          // Clear existing timeout
          if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
          }
          
          // Set typing to false after 3 seconds
          typingTimeoutRef.current = setTimeout(() => {
            setIsTyping(false);
          }, 3000);
        }
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('Successfully subscribed to realtime for chat:', chatId);
        } else {
          console.log('Subscription status changed:', status);
        }
      });
    
    // Store the channel reference
    realtimeChannelRef.current = channel;
    
    console.log('Realtime subscription activated for chat:', chatId);
    
    // Clean up subscription when component unmounts or chatId changes
    return () => {
      console.log('Cleaning up realtime subscription for chat:', chatId);
      if (realtimeChannelRef.current) {
        supabase.removeChannel(realtimeChannelRef.current);
        realtimeChannelRef.current = null;
      }
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      if (markAsReadTimeoutRef.current) {
        clearTimeout(markAsReadTimeoutRef.current);
      }
    };
  }, [chatId, user]);

  // Track overall unread message count across all chats
  useEffect(() => {
    if (!user) return;
    
    let isSubscribed = true;
    
    // Initial fetch
    fetchGlobalUnreadCount();
    
    // Subscribe to changes in the chat_messages table for all messages
    const subscription = supabase
      .channel('unread_messages_global')
      .on('postgres_changes', {
        event: '*', // Listen for all events
        schema: 'public',
        table: 'chat_messages',
      }, () => {
        // Refetch the unread count when any change happens
        if (isSubscribed) {
          fetchGlobalUnreadCount();
        }
      })
      .subscribe();
    
    return () => {
      isSubscribed = false;
      subscription.unsubscribe();
    };
  }, [user]);

  // Clean up timeouts on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      if (markAsReadTimeoutRef.current) {
        clearTimeout(markAsReadTimeoutRef.current);
      }
    };
  }, []);

  return (
    <ChatContext.Provider
      value={{
        chatId,
        messages,
        loading,
        error,
        sendMessage,
        setChatProposalId,
        markMessagesAsRead,
        unreadCount,
        isTyping,
        sendTypingIndicator,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}; 