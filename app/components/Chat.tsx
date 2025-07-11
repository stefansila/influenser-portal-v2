'use client';

import { useEffect, useRef, useState } from 'react';
import { useChat } from '../context/ChatContext';
import ChatMessage from './ChatMessage';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { v4 as uuidv4 } from 'uuid';

type ChatProps = {
  proposalId: string;
};

export default function Chat({ proposalId }: ChatProps) {
  const { 
    messages, 
    loading, 
    error, 
    sendMessage, 
    setChatProposalId, 
    markMessagesAsRead,
    chatId,
    isTyping,
    sendTypingIndicator
  } = useChat();
  const { user } = useAuth();
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [uploadError, setUploadError] = useState('');
  
  // Koristimo useRef da pratimo ID-ove poruka koje su već bile prikazane
  // Ovo pomaže da sprečimo dupliranje i nepotrebne re-rendere
  const processedMessageIds = useRef(new Set<string>());
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Set current proposal ID in context
    const initializeChat = async () => {
      if (!initialized) {
        console.log('Initializing chat for proposal:', proposalId);
        setIsLoading(true);
        await setChatProposalId(proposalId);
        setInitialized(true);
        setIsLoading(false);
        console.log('Chat initialized for proposal:', proposalId, 'Chat ID:', chatId);
      }
    };
    
    initializeChat();
  }, [proposalId, setChatProposalId, initialized, chatId]);

  // Scroll to bottom whenever messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
    
    // Ažuriraj set već prikazanih poruka
    messages.forEach(msg => {
      processedMessageIds.current.add(msg.id);
    });
  }, [messages]);

  // Mark messages as read when the component is mounted or when new messages arrive
  useEffect(() => {
    if (chatId && messages.length > 0) {
      console.log('Marking messages as read for chat:', chatId);
      markMessagesAsRead();
    }
  }, [chatId, messages, markMessagesAsRead]);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!newMessage.trim() && !selectedFile) || !user || !chatId) return;
    
    const messageText = newMessage; // Define outside try block so it's accessible in catch
    
    try {
      setIsLoading(true);
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
          setIsLoading(false);
          setUploadingFile(false);
          return;
        } finally {
          setUploadingFile(false);
        }
      }
      
      // Send message with attachment if present
      await sendMessage(messageText, attachmentUrl, fileName);
      console.log('Message sent successfully');
    } catch (error) {
      console.error('Error sending message:', error);
      // Ako dođe do greške, vratimo poruku u input polje
      setNewMessage(messageText);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewMessage(e.target.value);
    
    // Send typing indicator
    sendTypingIndicator();
    
    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    // Set a timeout to stop sending typing indicators
    typingTimeoutRef.current = setTimeout(() => {
      // Typing indicator will automatically expire on the receiving end
    }, 1000);
  };

  // Clean up timeout on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  // Filter duplicate messages to ensure stability
  const filteredMessages = messages.filter((message, index, self) => 
    self.findIndex(m => m.id === message.id) === index
  );
  
  if (loading || isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-8 h-8 border-t-2 border-[#FFB900] rounded-full animate-spin"></div>
          <p className="text-gray-400">Loading conversation...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-center">
          <div className="text-red-500 mb-2">Error loading chat</div>
          <p className="text-gray-400 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {filteredMessages.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="mx-auto mb-4 text-gray-600">
              <path d="M21 15C21 15.5304 20.7893 16.0391 20.4142 16.4142C20.0391 16.7893 19.5304 17 19 17H7L3 21V5C3 4.46957 3.21071 3.96086 3.58579 3.58579C3.96086 3.21071 4.46957 3 5 3H19C19.5304 3 20.0391 3.21071 20.4142 3.58579C20.7893 3.96086 21 4.46957 21 5V15Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <p className="text-lg font-medium mb-2">No messages yet</p>
            <p className="text-sm">Start the conversation by sending a message below!</p>
          </div>
        ) : (
          <>
            {filteredMessages.map((message) => (
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
                    <span className="text-xs text-gray-400 ml-2">Someone is typing...</span>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
        <div ref={messagesEndRef} />
      </div>
      
      {/* File upload error */}
      {uploadError && (
        <div className="px-4 py-2 bg-red-500/10 border-l-4 border-red-500 text-red-400 text-sm">
          {uploadError}
        </div>
      )}
      
      {/* Selected file preview */}
      {selectedFile && (
        <div className="px-4 py-2 bg-[#1A1A1A] border-t border-white/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-[#FFB900]">
                <path d="M14 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V8L14 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M14 2V8H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span className="text-white text-sm">{selectedFile.name}</span>
              <span className="text-gray-400 text-xs">({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)</span>
            </div>
            <button
              onClick={handleCancelFile}
              className="text-gray-400 hover:text-white transition-colors"
              title="Remove file"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>
        </div>
      )}
      
      <form onSubmit={handleSubmit} className="p-4 border-t border-white/5">
        <div className="flex gap-2">
          {/* File upload button */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="px-3 py-3 bg-[#1A1A1A] border border-white/10 rounded-lg text-gray-400 hover:text-white hover:border-[#FFB900] transition-colors"
            title="Attach file"
            disabled={isLoading || uploadingFile}
          >
            {uploadingFile ? (
              <div className="w-5 h-5 border-t-2 border-[#FFB900] rounded-full animate-spin" />
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M21.44 11.05L12.25 20.24C11.1242 21.3658 9.59722 21.9983 8.005 21.9983C6.41278 21.9983 4.88583 21.3658 3.76 20.24C2.63417 19.1142 2.00166 17.5872 2.00166 15.995C2.00166 14.4028 2.63417 12.8758 3.76 11.75L12.95 2.56C13.7006 1.80944 14.7186 1.38787 15.78 1.38787C16.8414 1.38787 17.8594 1.80944 18.61 2.56C19.3606 3.31056 19.7821 4.32856 19.7821 5.39C19.7821 6.45144 19.3606 7.46944 18.61 8.22L9.41 17.41C9.03494 17.7851 8.52556 17.9961 7.995 17.9961C7.46444 17.9961 6.95506 17.7851 6.58 17.41C6.20494 17.0349 5.99389 16.5256 5.99389 15.995C5.99389 15.4644 6.20494 14.9551 6.58 14.58L15.07 6.1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            )}
          </button>
          
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFileSelect}
            className="hidden"
            accept="image/*,application/pdf,.doc,.docx,.txt"
          />
          
          <input
            type="text"
            value={newMessage}
            onChange={handleInputChange}
            placeholder="Type a message..."
            className="flex-grow px-4 py-3 bg-[#1A1A1A] border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-[#FFB900] focus:border-[#FFB900] transition-colors"
            disabled={isLoading}
            autoComplete="off"
          />
          <button
            type="submit"
            disabled={isLoading || (!newMessage.trim() && !selectedFile)}
            className="px-4 py-3 bg-[#FFB900] text-black rounded-lg hover:bg-[#E6A800] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center min-w-[52px]"
            title="Send message"
          >
            {isLoading ? (
              <div className="w-5 h-5 border-t-2 border-black rounded-full animate-spin" />
            ) : (
              <svg
                width="20"
                height="20"
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
        </div>
      </form>
    </div>
  );
} 