'use client';

import { useAuth } from '../context/AuthContext';
import { ChatMessage as ChatMessageType } from '../context/ChatContext';

type ChatMessageProps = {
  message: ChatMessageType;
};

export default function ChatMessage({ message }: ChatMessageProps) {
  const { user } = useAuth();
  const isCurrentUser = message.user_id === user?.id;

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div
      className={`flex mb-4 ${
        isCurrentUser ? 'justify-end' : 'justify-start'
      }`}
    >
      <div
        className={`max-w-[75%] px-4 py-2 rounded-lg ${
          isCurrentUser
            ? 'bg-[#FFB900] text-black rounded-tr-none'
            : 'bg-[#1A1A1A] text-white rounded-tl-none'
        }`}
      >
        {!isCurrentUser && (
          <div className="text-sm font-medium mb-1">
            {message.user?.email || 'User'}
          </div>
        )}
        <p className="text-sm break-words">{message.message}</p>
        
        {message.attachment_url && (
          <div className="mt-2 border-t border-black/10 pt-2">
            <a 
              href={message.attachment_url} 
              target="_blank" 
              rel="noopener noreferrer"
              className={`flex items-center gap-2 text-sm p-2 rounded ${
                isCurrentUser ? 'bg-black/10 hover:bg-black/20' : 'bg-white/5 hover:bg-white/10'
              }`}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12.5 2H8C6.93913 2 5.92172 2.42143 5.17157 3.17157C4.42143 3.92172 4 4.93913 4 6V18C4 19.0609 4.42143 20.0783 5.17157 20.8284C5.92172 21.5786 6.93913 22 8 22H16C17.0609 22 18.0783 21.5786 18.8284 20.8284C19.5786 20.0783 20 19.0609 20 18V9.5L12.5 2Z" 
                  stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M12 2V10H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span className="truncate">{message.file_name || 'Attached file'}</span>
            </a>
          </div>
        )}
        
        <div
          className={`text-xs mt-1 ${
            isCurrentUser ? 'text-black/70' : 'text-white/60'
          }`}
        >
          {formatTime(message.created_at)}
        </div>
      </div>
    </div>
  );
} 