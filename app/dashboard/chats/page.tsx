'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';

type Proposal = {
  title: string;
  company_name: string;
};

type ChatListItem = {
  id: string;
  proposal_id: string;
  unread_count: number;
  last_message: string | null;
  last_message_time: string | null;
  proposal_title: string;
  company_name: string;
};

export default function ChatsPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [chats, setChats] = useState<ChatListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const realtimeChannelRef = useRef<any>(null);
  
  useEffect(() => {
    const fetchChats = async () => {
      if (!user) {
        router.push('/login');
        return;
      }
      
      try {
        // First check if the user is an admin
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('role')
          .eq('id', user.id)
          .single();
        
        if (userError) {
          console.error('Error fetching user data:', userError);
          setError('Failed to verify user role');
          setLoading(false);
          return;
        }
        
        const isAdmin = userData?.role === 'admin';
        
        // Get the proposals the user has responded to
        const { data: responsesData, error: responsesError } = await supabase
          .from('responses')
          .select('proposal_id')
          .eq('user_id', user.id);
        
        if (responsesError && !isAdmin) {
          console.error('Error fetching responses:', responsesError);
          setError('Failed to load chat data');
          setLoading(false);
          return;
        }
        
        // Create a list of proposal IDs
        const proposalIds = isAdmin 
          ? [] // Admin sees all chats, will get them directly
          : (responsesData || []).map(r => r.proposal_id);
        
        // If user has no responses and is not admin, show empty list
        if (proposalIds.length === 0 && !isAdmin) {
          setChats([]);
          setLoading(false);
          return;
        }
        
        // Fetch raw data first
        let rawChats;
        
        if (isAdmin) {
          // Admin sees all chats - get distinct chats by proposal_id (only the most recent for each proposal)
          const { data, error } = await supabase
            .from('chats')
            .select('id, proposal_id, created_at');
            
          if (error) {
            console.error('Error fetching chats for admin:', error);
            setError('Failed to load chats');
            setLoading(false);
            return;
          }
          
          // Group chats by proposal_id and keep only the most recent one
          const groupedChats = data.reduce((acc: Record<string, any>, chat: any) => {
            if (!acc[chat.proposal_id] || new Date(chat.created_at) > new Date(acc[chat.proposal_id].created_at)) {
              acc[chat.proposal_id] = chat;
            }
            return acc;
          }, {});
          
          rawChats = Object.values(groupedChats);
        } else {
          // Regular user only sees chats for proposals they've responded to and only their own chats
          const { data, error } = await supabase
            .from('chats')
            .select('id, proposal_id, created_at')
            .in('proposal_id', proposalIds)
            .eq('user_id', user.id); // Filter by user_id to ensure users only see their own chats
            
          if (error) {
            console.error('Error fetching chats for user:', error);
            setError('Failed to load chats');
            setLoading(false);
            return;
          }
          
          // For regular users, we can use the direct results as we're already filtering by user_id
          rawChats = data;
        }
        
        // Process each chat with additional details
        const processedChats: ChatListItem[] = [];
        
        for (const chat of rawChats) {
          // Get proposal details
          const { data: proposalData, error: proposalError } = await supabase
            .from('proposals')
            .select('title, company_name')
            .eq('id', chat.proposal_id)
            .single();
            
          if (proposalError) {
            console.error('Error fetching proposal details:', proposalError);
            continue; // Skip this chat
          }
          
          // Get unread count
          const { count: unreadCount, error: countError } = await supabase
            .from('chat_messages')
            .select('id', { count: 'exact' })
            .eq('chat_id', chat.id)
            .eq('is_read', false)
            .neq('user_id', user.id);
            
          if (countError) {
            console.error('Error fetching unread count:', countError);
          }
          
          // Get last message
          const { data: lastMessage, error: messageError } = await supabase
            .from('chat_messages')
            .select('message, created_at')
            .eq('chat_id', chat.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();
            
          if (messageError && messageError.code !== 'PGRST116') {
            console.error('Error fetching last message:', messageError);
          }
          
          processedChats.push({
            id: chat.id,
            proposal_id: chat.proposal_id,
            proposal_title: proposalData?.title || 'Untitled Proposal',
            company_name: proposalData?.company_name || 'Unknown Company',
            unread_count: unreadCount || 0,
            last_message: lastMessage?.message || null,
            last_message_time: lastMessage?.created_at || null,
          });
        }
        
        // Sort chats by last message time (most recent first)
        const sortedChats = processedChats.sort((a, b) => {
          if (!a.last_message_time) return 1;
          if (!b.last_message_time) return -1;
          
          return new Date(b.last_message_time).getTime() - new Date(a.last_message_time).getTime();
        });
        
        setChats(sortedChats);
      } catch (err: any) {
        console.error('Error fetching chats data:', err);
        setError(err.message || 'An error occurred');
      } finally {
        setLoading(false);
      }
    };
    
    if (!isLoading) {
      fetchChats();
    }
  }, [user, isLoading, router]);

  // Set up real-time subscription for user chat list updates
  useEffect(() => {
    if (!user || isLoading) return;

    console.log('Setting up real-time subscription for user chats list');

    // Clean up previous subscription
    if (realtimeChannelRef.current) {
      supabase.removeChannel(realtimeChannelRef.current);
    }

    // Create channel for chat messages updates
    const channel = supabase.channel('user-chats-list');
    realtimeChannelRef.current = channel;

    channel
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_messages',
      }, async (payload: any) => {
        console.log('New message detected in user chats, updating list:', payload);
        
        // Get the chat this message belongs to
        const { data: chatData, error: chatError } = await supabase
          .from('chats')
          .select('id, proposal_id, user_id, created_at')
          .eq('id', payload.new.chat_id)
          .single();

        if (chatError || !chatData) {
          console.error('Error fetching chat data for user update:', chatError);
          return;
        }

        // Check if this chat belongs to the current user or if user is admin
        const { data: userData } = await supabase
          .from('users')
          .select('role')
          .eq('id', user.id)
          .single();

        const isAdmin = userData?.role === 'admin';
        const isUserChat = chatData.user_id === user.id;

        if (!isAdmin && !isUserChat) {
          return; // This chat doesn't belong to current user
        }

        // Update the chats list
        setChats(prevChats => {
          const existingChatIndex = prevChats.findIndex(chat => chat.id === chatData.id);
          
          if (existingChatIndex >= 0) {
            // Update existing chat
            const updatedChats = [...prevChats];
            updatedChats[existingChatIndex] = {
              ...updatedChats[existingChatIndex],
              last_message: payload.new.message,
              last_message_time: payload.new.created_at,
              unread_count: payload.new.user_id !== user.id 
                ? updatedChats[existingChatIndex].unread_count + 1
                : updatedChats[existingChatIndex].unread_count
            };

            // Re-sort the chats by latest message time
            return updatedChats.sort((a, b) => {
              if (!a.last_message_time) return 1;
              if (!b.last_message_time) return -1;
              return new Date(b.last_message_time).getTime() - new Date(a.last_message_time).getTime();
            });
          } else {
            // This might be a new chat, refetch the list to be safe
            console.log('New chat detected, refetching chat list');
            // We could refetch here, but for now just return the existing list
            return prevChats;
          }
        });
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'chat_messages',
      }, async (payload: any) => {
        // Handle message updates (like marking as read)
        if (payload.new.is_read && !payload.old.is_read) {
          console.log('Message marked as read, updating unread count');
          
          const { data: chatData } = await supabase
            .from('chats')
            .select('id, user_id')
            .eq('id', payload.new.chat_id)
            .single();

          const { data: currentUserData } = await supabase
            .from('users')
            .select('role')
            .eq('id', user.id)
            .single();

          if (chatData && (chatData.user_id === user.id || currentUserData?.role === 'admin')) {
            setChats(prevChats => {
              return prevChats.map(chat => {
                if (chat.id === chatData.id) {
                  return {
                    ...chat,
                    unread_count: Math.max(0, chat.unread_count - 1)
                  };
                }
                return chat;
              });
            });
          }
        }
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('Successfully subscribed to user chats list updates');
        } else {
          console.log('User chats list subscription status:', status);
        }
      });

    // Cleanup subscription
    return () => {
      console.log('Cleaning up user chats list subscription');
      if (realtimeChannelRef.current) {
        supabase.removeChannel(realtimeChannelRef.current);
        realtimeChannelRef.current = null;
      }
    };
  }, [user, isLoading]);
  
  const formatTime = (timestamp: string | null) => {
    if (!timestamp) return '';
    
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      // Today, show time
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays === 1) {
      // Yesterday
      return 'Yesterday';
    } else if (diffDays < 7) {
      // Within a week, show day name
      return date.toLocaleDateString([], { weekday: 'long' });
    } else {
      // More than a week, show date
      return date.toLocaleDateString([], { 
        month: 'short', 
        day: 'numeric' 
      });
    }
  };
  
  if (isLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="w-8 h-8 border-t-2 border-white rounded-full animate-spin"></div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="p-8 min-h-screen bg-background">
        <h1 className="text-2xl font-bold text-white mb-6">Chats</h1>
        <div className="flex flex-col items-center justify-center p-12 bg-[#121212] border border-white/5 text-center rounded-md">
          <p className="text-xl text-gray-300 mb-3">Error</p>
          <p className="text-gray-400">{error}</p>
        </div>
      </div>
    );
  }
  
  if (chats.length === 0) {
    return (
      <div className="p-8 min-h-screen bg-background">
        <h1 className="text-2xl font-bold text-white mb-6">Chats</h1>
        <div className="flex flex-col items-center justify-center p-12 bg-[#121212] border border-white/5 text-center rounded-md">
          <p className="text-xl text-gray-300 mb-3">No Chats Available</p>
          <p className="text-gray-400">You don't have any active chats.</p>
          <Link
            href="/dashboard"
            className="mt-6 px-6 py-2 bg-[#FFB900] text-black rounded-full font-medium hover:bg-[#E6A800] transition-colors"
          >
            Browse Proposals
          </Link>
        </div>
      </div>
    );
  }
  
  return (
    <div className="p-8 min-h-screen bg-background">
      <h1 className="text-2xl font-bold text-white mb-6">Chats</h1>
      
      <div className="grid grid-cols-1 gap-4">
        {chats.map((chat) => (
          <Link
            key={chat.id}
            href={`/dashboard/chats/${chat.proposal_id}`}
            className="block"
          >
            <div className="flex items-start p-4 bg-[#121212] border border-white/5 rounded-lg hover:border-white/20 transition-colors">
              <div className="flex-grow mr-4">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-white font-medium truncate">
                    {chat.proposal_title}
                  </h3>
                  {chat.last_message_time && (
                    <span className="text-gray-400 text-xs">
                      {formatTime(chat.last_message_time)}
                    </span>
                  )}
                </div>
                <p className="text-gray-400 text-sm">
                  {chat.company_name}
                </p>
                
                {chat.last_message && (
                  <p className="mt-2 text-white/60 text-sm truncate">
                    {chat.last_message}
                  </p>
                )}
              </div>
              
              {chat.unread_count > 0 && (
                <div className="flex-shrink-0 bg-[#FFB900] text-black text-xs font-medium h-5 min-w-5 flex items-center justify-center rounded-full px-1.5">
                  {chat.unread_count > 99 ? '99+' : chat.unread_count}
                </div>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
} 