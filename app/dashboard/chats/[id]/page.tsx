'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '../../../context/AuthContext';
import { supabase } from '../../../lib/supabase';
import ChatMessage from '../../../components/ChatMessage';
import { v4 as uuidv4 } from 'uuid';
import { ChatMessage as MessageType } from '../../../context/ChatContext';
import { useChat } from '../../../context/ChatContext';

type ProposalInfo = {
  id: string;
  title: string;
  company_name: string;
};

export default function ChatPage({ params }: { params: { id: string } }) {
  const { user, isLoading } = useAuth();
  const { markMessagesAsRead, setChatProposalId } = useChat();
  const router = useRouter();
  const [proposal, setProposal] = useState<ProposalInfo | null>(null);
  const [responseId, setResponseId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageType[]>([]);
  const [chatId, setChatId] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const realtimeChannelRef = useRef<any>(null);

  // Local function to mark messages as read for specific chat
  const markMessagesAsReadLocal = async (chatIdToMark: string) => {
    if (!user || !chatIdToMark) return;
    
    try {
      // Mark all unread messages in this chat as read
      const { error } = await supabase
        .from('chat_messages')
        .update({ is_read: true })
        .eq('chat_id', chatIdToMark)
        .eq('is_read', false)
        .neq('user_id', user.id);
      
      if (error) {
        console.error('Error marking messages as read:', error);
        return;
      }
      
      console.log('Messages marked as read for chat:', chatIdToMark);
    } catch (err) {
      console.error('Error marking messages as read:', err);
    }
  };

  // Inicijalno učitavanje podataka
  useEffect(() => {
    const fetchProposalInfo = async () => {
      if (!user) {
        router.push('/login');
        return;
      }

      try {
        setLoading(true);
        
        // Provera da li predlog postoji i da li korisnik ima pristup
        const { data: proposalData, error: proposalError } = await supabase
          .from('proposals')
          .select('id, title, company_name')
          .eq('id', params.id)
          .single();

        if (proposalError) {
          if (proposalError.code === 'PGRST116') {
            setError('Proposal not found');
          } else {
            console.error('Error fetching proposal:', proposalError);
            setError('Failed to load proposal information');
          }
          setLoading(false);
          return;
        }

        // Provera da li korisnik ima odgovor na ovaj predlog
        const { data: responseData, error: responseError } = await supabase
          .from('responses')
          .select('id')
          .eq('proposal_id', params.id)
          .eq('user_id', user.id)
          .maybeSingle();

        if (responseError) {
          console.error('Error checking user response:', responseError);
          setError('Failed to verify your access to this chat');
          setLoading(false);
          return;
        }
        
        // Save the response ID if it exists
        if (responseData?.id) {
          setResponseId(responseData.id);
        }

        // Ako korisnik nije admin i nema odgovor na ovaj predlog, zabrani pristup
        const { data: userData } = await supabase
          .from('users')
          .select('role')
          .eq('id', user.id)
          .single();

        const isAdmin = userData?.role === 'admin';

        if (!isAdmin && !responseData) {
          setError('You do not have access to this chat');
          setLoading(false);
          return;
        }

        // Provera da li chat postoji za ovaj predlog
        const { data: chatData, error: chatError } = await supabase
          .from('chats')
          .select('id')
          .eq('proposal_id', params.id)
          .eq('user_id', user.id);
          
        if (chatError) {
          console.error('Error checking chat existence:', chatError);
          setLoading(false);
          return;
        }
        
        // Učitaj postojeći chat ili kreiraj novi
        let activeChat;
        
        if (!chatData || chatData.length === 0) {
          // Kreiraj nov chat
          const { data: newChat, error: createError } = await supabase
            .from('chats')
            .insert({ 
              proposal_id: params.id, 
              user_id: user.id  // Ensure the chat is associated with this user
            })
            .select()
            .single();
            
          if (createError) {
            console.error('Error creating chat:', createError);
            setError('Failed to create chat');
            setLoading(false);
            return;
          }
          
          activeChat = newChat;
        } else {
          // Use the user's chat for this proposal
          activeChat = chatData[0];
        }
        
        setChatId(activeChat.id);
        setProposal(proposalData);
        
        // Set the chat proposal ID in the global context
        await setChatProposalId(params.id);
        
        // Učitaj poruke za ovaj chat
        const { data: messagesData, error: messagesError } = await supabase
          .from('chat_messages')
          .select(`
            id,
            chat_id,
            user_id,
            message,
            created_at,
            is_read,
            attachment_url,
            file_name,
            user:users(full_name, email)
          `)
          .eq('chat_id', activeChat.id)
          .order('created_at', { ascending: true });
          
        if (messagesError) {
          console.error('Error fetching messages:', messagesError);
        } else {
          console.log('Successfully fetched messages:', messagesData?.length || 0);
          // Konvertuj rezultate u pravi tip Message
          const typedMessages: MessageType[] = messagesData.map((msg: any) => ({
            id: msg.id,
            chat_id: msg.chat_id,
            user_id: msg.user_id,
            message: msg.message,
            created_at: msg.created_at,
            is_read: msg.is_read,
            attachment_url: msg.attachment_url,
            file_name: msg.file_name,
            user: msg.user
          }));
          setMessages(typedMessages);
          
          // Označi poruke kao pročitane
          const unreadIds = messagesData
            .filter((msg: any) => !msg.is_read && msg.user_id !== user.id)
            .map((msg: any) => msg.id);
            
          if (unreadIds.length > 0) {
            console.log('Marking messages as read:', unreadIds.length);
            await markMessagesAsReadLocal(activeChat.id);
          }
        }
      } catch (err: any) {
        console.error('Error:', err);
        setError(err.message || 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    if (!isLoading) {
      fetchProposalInfo();
    }
  }, [user, isLoading, params.id, router]);
  
  // Real-time pretplata za nove poruke
  useEffect(() => {
    if (!chatId || !user) return;
    
    console.log('Setting up real-time chat subscription for chatId:', chatId);
    
    // Clean up previous subscription
    if (realtimeChannelRef.current) {
      supabase.removeChannel(realtimeChannelRef.current);
    }
    
    // Kreiraj jedinstveno ime kanala za ovaj chat
    const channelName = `user-chat-${chatId}`;
    console.log('Creating channel:', channelName);
    
    // Pretplati se na nove poruke
    const channel = supabase.channel(channelName);
    realtimeChannelRef.current = channel;
    
    const subscription = channel
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_messages',
        filter: `chat_id=eq.${chatId}`,
      }, async (payload: any) => {
        console.log('New message received via postgres_changes:', payload);
        
        // Preskoči poruke koje je poslao trenutni korisnik (već su dodane optimistički)
        if (payload.new.user_id === user?.id) {
          console.log('Skipping subscription update for own message');
          return;
        }
        
        // Dohvati podatke o korisniku za novu poruku
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('full_name, email')
          .eq('id', payload.new.user_id)
          .single();
          
        if (userError) {
          console.error('Error fetching user data for message:', userError);
        }
        
        const newMsg = {
          ...payload.new,
          user: userData || null
        };
        
        console.log('Adding new message to state:', newMsg);
        
        // Dodaj u poruke
        setMessages(prev => {
          // Proveri da li poruka već postoji da bi sprečio dupliranje
          if (prev.some(msg => msg.id === newMsg.id)) {
            console.log('Message already exists, skipping:', newMsg.id);
            return prev;
          }
          console.log('New message added to state:', newMsg.id);
          return [...prev, newMsg];
        });
        
        // Označi kao pročitano ako nije od trenutnog korisnika
        if (payload.new.user_id !== user?.id) {
          await markMessagesAsReadLocal(chatId);
        }
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('Successfully subscribed to postgres changes for chat:', chatId);
        } else {
          console.log('Subscription status changed:', status);
        }
      });
    
    console.log('Subscription activated for chat:', chatId);
    
    return () => {
      console.log('Cleaning up subscription for chat:', chatId);
      if (realtimeChannelRef.current) {
        supabase.removeChannel(realtimeChannelRef.current);
        realtimeChannelRef.current = null;
      }
    };
  }, [chatId, user]);
  
  // Scroll na dno kada se promene poruke
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);
  
  // Funkcija za slanje poruke
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if ((!newMessage.trim() && !selectedFile) || !user || !chatId) return;
    
    try {
      setSendingMessage(true);
      const messageText = newMessage;
      setNewMessage(''); // Očisti polje odmah
      
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
          setSendingMessage(false);
          setUploadingFile(false);
          return;
        } finally {
          setUploadingFile(false);
        }
      }
      
      // Pošalji poruku
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
        setNewMessage(messageText); // Vrati poruku nazad u input u slučaju greške
        return;
      }
      
      // Tretiraj data kao objekat sa id i created_at
      const msgData = data as { id: string; created_at: string };
      
      // Dodaj optimističko ažuriranje
      const optimisticMessage: MessageType = {
        id: msgData.id,
        chat_id: chatId,
        user_id: user.id,
        message: messageText,
        created_at: msgData.created_at,
        is_read: false,
        attachment_url: attachmentUrl,
        file_name: fileName,
        user: {
          full_name: user.user_metadata?.full_name || null,
          email: user.email || null
        }
      };
      
      setMessages(prev => [...prev, optimisticMessage]);
    } catch (err) {
      console.error('Error sending message:', err);
      setNewMessage(newMessage); // Vrati poruku nazad u input
    } finally {
      setSendingMessage(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      
      // Check file size (max 20MB)
      if (file.size > 20 * 1024 * 1024) {
        setUploadError('File is too large. Maximum size is 20MB.');
        return;
      }
      
      setSelectedFile(file);
      setUploadError(null);
    }
  };
  
  const handleCancelFile = () => {
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  if (isLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="w-8 h-8 border-t-2 border-white rounded-full animate-spin"></div>
      </div>
    );
  }

  if (error || !proposal) {
    return (
      <div className="p-8 min-h-screen bg-background">
        <div className="mb-8">
          <Link
            href="/dashboard"
            className="text-[#FFB900] flex items-center space-x-2"
          >
            <svg width="7" height="14" viewBox="0 0 7 14" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M6 1L1 7L6 13" stroke="#FFB900" strokeWidth="1.67" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span>Back</span>
          </Link>
        </div>
        <div className="flex flex-col items-center justify-center p-12 bg-[#121212] border border-white/5 text-center rounded-md">
          <p className="text-xl text-gray-300 mb-3">{error || 'Proposal not found'}</p>
          <p className="text-gray-400">You cannot access this chat</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 min-h-screen bg-background">
      {/* Back button */}
      <div className="mb-8">
        <Link
          href={`/dashboard/proposal/${proposal.id}`}
          className="text-[#FFB900] flex items-center space-x-2"
        >
          <svg width="7" height="14" viewBox="0 0 7 14" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M6 1L1 7L6 13" stroke="#FFB900" strokeWidth="1.67" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span>Back to Proposal</span>
        </Link>
      </div>
      
      {/* Chat header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">{proposal.title}</h1>
        <p className="text-gray-400">{proposal.company_name}</p>
        
        {/* Action buttons */}
        <div className="flex gap-4 mt-4">
          <Link
            href={`/dashboard/proposal/${proposal.id}`}
            className="px-4 py-2 bg-[#1A1A1A] text-white rounded-lg hover:bg-[#292929] transition-colors border border-white/10 flex items-center gap-2"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M14 3v4a1 1 0 0 0 1 1h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M9 9h1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <path d="M9 13h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <path d="M9 17h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            View Proposal
          </Link>
          <Link
            href={`/dashboard/view-response?id=${responseId}`}
            className={`px-4 py-2 bg-[#1A1A1A] text-white rounded-lg hover:bg-[#292929] transition-colors border border-white/10 flex items-center gap-2 ${!responseId ? 'opacity-50 pointer-events-none' : ''}`}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 18.5L9 17L4 18.5V5.5L9 4L15 5.5L20 4V13.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M9 4V17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M15 5.5V11.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M18 21V16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M15 18H21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            View Response
          </Link>
        </div>
      </div>
      
      {/* Chat container */}
      <div className="bg-[#121212] rounded-lg border border-white/5 h-[calc(100vh-220px)] flex flex-col">
        <div className="p-4 border-b border-white/5">
          <h3 className="text-white font-medium">Conversation</h3>
        </div>
        
        <div className="flex-grow overflow-y-auto p-4">
          {messages.length === 0 ? (
            <div className="h-full flex items-center justify-center">
              <p className="text-gray-400 text-center">
                No messages yet. Start the conversation!
              </p>
            </div>
          ) : (
            <>
              {messages.map((message) => (
                <ChatMessage key={message.id} message={message} />
              ))}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>
        
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
          
          <form onSubmit={handleSendMessage} className="flex gap-2">
            <div className="relative flex-grow">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Type a message..."
                className="w-full px-4 py-3 bg-[#1A1A1A] border border-white/10 rounded-lg text-white focus:outline-none focus:ring-1 focus:ring-[#FFB900]"
                disabled={sendingMessage || uploadingFile}
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
                  if (sendingMessage || uploadingFile) {
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
              disabled={sendingMessage || uploadingFile || (!newMessage.trim() && !selectedFile)}
              className="px-4 py-3 bg-[#FFB900] text-black rounded-lg hover:bg-[#E6A800] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {(sendingMessage || uploadingFile) ? (
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