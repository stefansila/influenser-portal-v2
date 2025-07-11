'use client';

import { useState, useEffect, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '../../../context/AuthContext';
import { useAdminChat } from '../../../context/AdminChatContext';
import { supabase } from '../../../lib/supabase';
import ChatMessage from '../../../components/ChatMessage';
import Link from 'next/link';
import { ChatMessage as MessageType } from '../../../context/ChatContext';
import { v4 as uuidv4 } from 'uuid';

type AdminChatParams = {
  params: {
    chatId: string;
  };
};

export default function AdminChatPage({ params }: AdminChatParams) {
  const { chatId } = params;
  const searchParams = useSearchParams();
  const proposalId = searchParams?.get('proposalId');
  const router = useRouter();
  const [messages, setMessages] = useState<MessageType[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [chatDetails, setChatDetails] = useState<{
    proposalTitle: string;
    userName: string;
    userEmail: string;
    proposalId: string;
    responseId?: string;
  }>({
    proposalTitle: 'Chat',
    userName: 'User',
    userEmail: '',
    proposalId: '',
  });
  const { user } = useAuth();
  const { markMessagesAsRead } = useAdminChat();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const realtimeChannelRef = useRef<any>(null);
  
  // Fetch chat details and messages
  useEffect(() => {
    const fetchData = async () => {
      if (!user || !chatId) return;
      
      try {
        setLoading(true);
        
        console.log('Fetching chat data for chatId:', chatId);
        
        // Get chat details including user info and proposal title - koristimo isti format kao na chat listi
        const { data: chatData, error: chatError } = await supabase
          .from('chats')
          .select(`
            id,
            proposal_id,
            user_id,
            created_at
          `)
          .eq('id', chatId)
          .single();
          
        if (chatError) {
          console.error('Error fetching chat details:', chatError);
          return;
        }
        
        console.log('Basic chat data:', chatData);
        
        // Posebno dohvati proposal podatke
        const { data: proposalData, error: proposalError } = await supabase
          .from('proposals')
          .select('id, title')
          .eq('id', chatData.proposal_id)
          .single();
          
        if (proposalError) {
          console.error('Error fetching proposal:', proposalError);
        }
        
        console.log('Proposal data:', proposalData);
        
        // Posebno dohvati korisničke podatke
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('id, full_name, email')
          .eq('id', chatData.user_id)
          .single();
          
        if (userError) {
          console.error('Error fetching user:', userError);
        }
        
        console.log('User data:', userData);
        
        // Izvuci tačne podatke
        const proposalTitle = proposalData?.title || 'Unnamed Proposal';
        const userName = userData?.full_name || 'Unknown User';
        const userEmail = userData?.email || 'Unknown Email';
        const proposalId = chatData.proposal_id || '';
        
        console.log('Extracted data:', { proposalTitle, userName, userEmail, proposalId });

        // Get response ID if exists
        const { data: responseData } = await supabase
          .from('responses')
          .select('id')
          .eq('proposal_id', chatData.proposal_id)
          .eq('user_id', chatData.user_id)
          .maybeSingle();
        
        console.log('Response data:', responseData);
        
        setChatDetails({
          proposalTitle,
          userName,
          userEmail,
          proposalId,
          responseId: responseData?.id
        });
        
        console.log('Set chatDetails to:', {
          proposalTitle,
          userName,
          userEmail,
          proposalId,
          responseId: responseData?.id
        });

        // Fetch messages for this chat using the view
        const { data: messagesData, error: messagesError } = await supabase
          .from('chat_messages_with_users')
          .select('*')
          .eq('chat_id', chatId)
          .order('created_at', { ascending: true });
          
        if (messagesError) {
          console.error('Error fetching messages:', messagesError);
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
        
        // Automatically mark messages as read after a short delay
        const unreadMessages = formattedMessages.filter(msg => 
          !msg.is_read && msg.user_id !== user.id
        );
        
        if (unreadMessages.length > 0) {
          // Mark as read immediately for admin (no delay)
          markMessagesAsRead(chatId);
        }
      } catch (err) {
        console.error('Error fetching chat data:', err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [chatId, user]); // Remove markMessagesAsRead from dependencies
  
  // Set up real-time subscription
  useEffect(() => {
    if (!user || !chatId) return;
    
    console.log('Creating admin channel:', `chat-${chatId}`);
    
    // Clean up previous subscription
    if (realtimeChannelRef.current) {
      supabase.removeChannel(realtimeChannelRef.current);
    }
    
    const channel = supabase.channel(`chat-${chatId}`);
    realtimeChannelRef.current = channel;
    
    const subscription = channel
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_messages',
        filter: `chat_id=eq.${chatId}`,
      }, async (payload: any) => {
        console.log('New message received via postgres_changes:', payload);
        
        // Skip if message was sent by current admin (already handled by optimistic update)
        if (payload.new.user_id === user?.id) {
          console.log('Skipping subscription update for own message');
          return;
        }
        
        // When a new message comes in, fetch the user data
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('full_name, email')
          .eq('id', payload.new.user_id)
          .single();
          
        if (userError) {
          console.error('Error fetching user data for new message:', userError);
        }
        
        const newMsg = {
          ...payload.new,
          user: userData || { full_name: null, email: null }
        };
        
        console.log('Adding new message to admin state:', newMsg);
        
        // Add to messages
        setMessages(prev => {
          // Check if message already exists to prevent duplicates
          if (prev.some(msg => msg.id === newMsg.id)) {
            console.log('Message already exists in admin chat, skipping:', newMsg.id);
            return prev;
          }
          console.log('New message added to admin state:', newMsg.id);
          return [...prev, newMsg];
        });
        
        // Automatically mark the new message as read immediately (no delay)
        markMessagesAsRead(chatId);
      })
      .on('broadcast', { event: 'typing' }, (payload) => {
        // Handle typing indicators
        if (payload.payload.userId !== user?.id) {
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
      .subscribe();
    
    // Clean up subscription
    return () => {
      console.log('Cleaning up admin chat subscription');
      if (realtimeChannelRef.current) {
        supabase.removeChannel(realtimeChannelRef.current);
        realtimeChannelRef.current = null;
      }
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [chatId, user]);
  
  // Scroll to bottom when messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);
  
  // Handle file selection
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFile(e.target.files[0]);
      setUploadError('');
    }
  };
  
  // Handle file cancel
  const handleCancelFile = () => {
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setUploadError('');
  };
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewMessage(e.target.value);
    
    // Send typing indicator via existing realtime channel
    if (chatId && user && realtimeChannelRef.current) {
      realtimeChannelRef.current.send({
        type: 'broadcast',
        event: 'typing',
        payload: { 
          userId: user.id,
          userName: user.user_metadata?.full_name || user.email,
          timestamp: Date.now()
        }
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!newMessage.trim() && !selectedFile) || !user || !chatId) return;
    
    try {
      setSending(true);
      const messageText = newMessage;
      setNewMessage(''); // Clear input immediately
      
      let attachmentUrl = '';
      let fileName = '';
      
      // Upload file if present
      if (selectedFile) {
        setUploadingFile(true);
        
        try {
          // Generate unique file name with original extension
          const fileExt = selectedFile.name.split('.').pop();
          const uniqueFileName = `${uuidv4()}.${fileExt}`;
          const filePath = `${user.id}/${uniqueFileName}`;
          
          // Upload file to 'chat' bucket
          const { error: uploadError } = await supabase.storage
            .from('chat')
            .upload(filePath, selectedFile, {
              cacheControl: '3600',
              upsert: false
            });
            
          if (uploadError) throw uploadError;
          
          // Get public URL
          const { data: urlData } = supabase.storage
            .from('chat')
            .getPublicUrl(filePath);
            
          attachmentUrl = urlData.publicUrl;
          fileName = selectedFile.name;
          
          // Clear selected file
          setSelectedFile(null);
          if (fileInputRef.current) fileInputRef.current.value = '';
          
        } catch (fileError: any) {
          console.error('Error uploading file:', fileError);
          setUploadError('Failed to upload file. Please try again.');
          setSending(false);
          setUploadingFile(false);
          return;
        } finally {
          setUploadingFile(false);
        }
      }
      
      // Generate a temporary ID for optimistic updates
      const tempId = `temp-${Date.now()}`;
      const now = new Date().toISOString();
      
      // Add message to UI immediately (optimistic update)
      const optimisticMessage: MessageType = {
        id: tempId,
        chat_id: chatId,
        user_id: user.id,
        message: messageText,
        created_at: now,
        is_read: false,
        attachment_url: attachmentUrl || undefined,
        file_name: fileName || undefined,
        user: {
          full_name: user?.email?.split('@')[0] || null,
          email: user.email || null
        }
      };
      
      setMessages(prev => [...prev, optimisticMessage]);
      
      // Add message to database
      const { data, error } = await supabase
        .from('chat_messages')
        .insert({
          chat_id: chatId,
          user_id: user.id,
          message: messageText,
          is_read: false,
          attachment_url: attachmentUrl || null,
          file_name: fileName || null
        })
        .select('id, created_at')
        .single();
        
      if (error) {
        console.error('Error sending message:', error);
        // Remove the optimistic message if there was an error
        setMessages(prev => prev.filter(msg => msg.id !== tempId));
        setNewMessage(messageText); // Return message to input in case of error
        return;
      }
      
      // Update the temporary message with the real ID
      if (data) {
        setMessages(prev => 
          prev.map(msg => 
            msg.id === tempId 
              ? { ...msg, id: data.id, created_at: data.created_at } 
              : msg
          )
        );
      }


      
    } catch (err) {
      console.error('Error sending message:', err);
    } finally {
      setSending(false);
    }
  };
  
  // Handle delete chat
  const handleDeleteChat = async () => {
    if (!confirm("Are you sure you want to delete this chat? This action cannot be undone.")) {
      return;
    }
    
    try {
      setSending(true);
      
      // Delete all messages in the chat
      const { error: messagesError } = await supabase
        .from('chat_messages')
        .delete()
        .eq('chat_id', chatId);
        
      if (messagesError) {
        console.error('Error deleting chat messages:', messagesError);
        alert('Failed to delete chat messages');
        return;
      }
      
      // Delete the chat itself
      const { error: chatError } = await supabase
        .from('chats')
        .delete()
        .eq('id', chatId);
        
      if (chatError) {
        console.error('Error deleting chat:', chatError);
        alert('Failed to delete chat');
        return;
      }
      
      // Redirect back to chats list
      router.push('/admin/chats');
      
    } catch (err) {
      console.error('Error during chat deletion:', err);
      alert('An error occurred during chat deletion');
    } finally {
      setSending(false);
    }
  };
  
  if (loading) {
    return (
      <div className="min-h-screen p-6 bg-background text-white">
        <div className="flex items-center gap-2 mb-6">
          <button 
            onClick={() => router.push('/admin/chats')}
            className="p-2 rounded-full hover:bg-white/5"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M19 12H5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M12 19L5 12L12 5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <h1 className="text-2xl font-bold">Loading chat...</h1>
        </div>
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-t-2 border-[#FFB900] rounded-full animate-spin"></div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen p-6 bg-background text-white">
      <div className="flex flex-col h-[calc(100vh-3rem)]">
        {/* Header */}
        <div className="flex items-center gap-2 mb-6">
          <button 
            onClick={() => router.push('/admin/chats')}
            className="p-2 rounded-full hover:bg-white/5"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M19 12H5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M12 19L5 12L12 5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          
          <div className="flex flex-col">
            <h1 className="text-2xl font-bold text-[#FFB900]">
              {chatDetails.proposalTitle || 'Proposal Chat'}
            </h1>
            <p className="text-sm text-gray-400">
              Chatting with <span className="text-white font-medium">
                {chatDetails.userEmail || chatDetails.userName || 'User'}
              </span>
            </p>
            <pre className="hidden">
              {JSON.stringify({
                proposalTitle: chatDetails.proposalTitle,
                userName: chatDetails.userName,
                userEmail: chatDetails.userEmail,
                proposalId: chatDetails.proposalId,
                responseId: chatDetails.responseId
              }, null, 2)}
            </pre>
          </div>
          
          <div className="ml-auto flex items-center gap-2">
            {chatDetails.responseId && (
              <Link 
                href={`/admin/response/${chatDetails.responseId}`}
                className="px-4 py-2 bg-[#1A1A1A] border border-white/10 rounded-lg hover:bg-[#242424] transition-colors text-sm"
              >
                View Response
              </Link>
            )}
            
            <button
              onClick={handleDeleteChat}
              className="px-4 py-2 bg-red-600/80 text-white rounded-lg hover:bg-red-600 transition-colors text-sm"
              disabled={sending}
            >
              Delete Chat
            </button>
          </div>
        </div>
        
        {/* Messages */}
        <div className="flex-1 overflow-y-auto bg-[#121212] border border-white/10 rounded-lg p-4 mb-4">
          {messages.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="mx-auto mb-4 text-gray-600">
                <path d="M21 15C21 15.5304 20.7893 16.0391 20.4142 16.4142C20.0391 16.7893 19.5304 17 19 17H7L3 21V5C3 4.46957 3.21071 3.96086 3.58579 3.58579C3.96086 3.21071 4.46957 3 5 3H19C19.5304 3 20.0391 3.21071 20.4142 3.58579C20.7893 3.96086 21 4.46957 21 5V15Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <p className="text-lg font-medium mb-2">No messages yet</p>
              <p className="text-sm">Start the conversation by sending a message below!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((message) => (
                <ChatMessage key={message.id} message={message} />
              ))}
              
              {/* Typing indicator */}
              {isTyping && (
                <div className="flex justify-start mb-4">
                  <div className="max-w-[75%] px-4 py-2 rounded-lg bg-[#1A1A1A] text-white rounded-tl-none">
                    <div className="flex items-center space-x-1">
                      <div className="flex space-x-1">
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                      </div>
                      <span className="text-xs text-gray-400 ml-2">{chatDetails.userName || 'User'} is typing...</span>
                    </div>
                  </div>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>
        
        {/* Message input */}
        <div className="p-4 border-t border-white/5">
          {selectedFile && (
            <div className="mb-2 bg-[#1A1A1A] rounded-lg p-2 flex items-center justify-between">
              <div className="flex items-center gap-2 text-white text-sm">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12.5 2H8C6.93913 2 5.92172 2.42143 5.17157 3.17157C4.42143 3.92172 4 4.93913 4 6V18C4 19.0609 4.42143 20.0783 5.17157 20.8284C5.92172 21.5786 6.93913 22 8 22H16C17.0609 22 18.0783 21.5786 18.8284 20.8284C19.5786 20.0783 20 19.0609 20 18V9.5L12.5 2Z" 
                    stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M12 2V10H20" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <span className="truncate max-w-[200px]">{selectedFile.name}</span>
                <span className="text-gray-400 text-xs">
                  ({(selectedFile.size / 1024).toFixed(0)} KB)
                </span>
              </div>
              <button 
                onClick={handleCancelFile}
                className="text-gray-400 hover:text-white"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>
          )}
          
          {uploadError && (
            <div className="mb-2 text-red-500 text-sm p-2 bg-red-500/10 rounded">
              {uploadError}
            </div>
          )}
          
          <form onSubmit={handleSubmit} className="flex gap-2">
            <div className="relative flex-grow">
              <input
                type="text"
                value={newMessage}
                onChange={handleInputChange}
                placeholder="Type a message..."
                className="w-full px-4 py-3 bg-[#1A1A1A] border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-[#FFB900] focus:border-[#FFB900] transition-colors"
                disabled={sending || uploadingFile}
                autoComplete="off"
              />
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelect}
                className="hidden"
                id="chat-file-input"
              />
              <label
                htmlFor="chat-file-input"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white cursor-pointer"
                onClick={(e) => {
                  if (sending || uploadingFile) {
                    e.preventDefault();
                  }
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M21 10L21 8C21 6.89543 20.1046 6 19 6L5 6C3.89543 6 3 6.89543 3 8L3 16C3 17.1046 3.89543 18 5 18L7 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M14.5 15L17.5 12L14.5 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M17.5 12L9.5 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </label>
            </div>
            <button
              type="submit"
              disabled={sending || uploadingFile || (!newMessage.trim() && !selectedFile)}
              className="px-4 py-3 bg-[#FFB900] text-black rounded-lg hover:bg-[#E6A800] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {sending || uploadingFile ? (
                <span className="inline-block w-5 h-5 border-t-2 border-black rounded-full animate-spin" />
              ) : (
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M20.25 12L3.75 3.75L6.375 12L3.75 20.25L20.25 12Z"
                    fill="currentColor"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
} 