'use client'

import { useEffect, useState, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import Image from 'next/image'

type Message = {
  id: string
  content: string
  created_at: string
  sender_id: string
  sender_name: string
  sender_avatar?: string
}

export default function Chat() {
  const { user } = useAuth()
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [isTyping, setIsTyping] = useState(false)
  const typingTimeoutRef = useRef<NodeJS.Timeout>()

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    const fetchMessages = async () => {
      try {
        const { data, error } = await supabase
          .from('messages')
          .select('*')
          .order('created_at', { ascending: true })
        
        if (error) throw error
        
        setMessages(data || [])
      } catch (error) {
        console.error('Error fetching messages:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchMessages()

    // Subscribe to new messages
    const subscription = supabase
      .channel('messages')
      .on('INSERT', 'messages', (payload) => {
        setMessages(prev => [...prev, payload.new as Message])
      })
      .subscribe()

    // Subscribe to typing indicators
    const typingSubscription = supabase
      .channel('typing')
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
        if (payload.userId !== user?.id) {
          setIsTyping(true)
          if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current)
          }
          typingTimeoutRef.current = setTimeout(() => {
            setIsTyping(false)
          }, 2000)
        }
      })
      .subscribe()

    return () => {
      subscription.unsubscribe()
      typingSubscription.unsubscribe()
    }
  }, [user?.id])

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMessage.trim() || !user) return

    try {
      const { error } = await supabase
        .from('messages')
        .insert({
          content: newMessage,
          sender_id: user.id,
          sender_name: user.email || 'User',
          sender_avatar: null
        })

      if (error) throw error

      setNewMessage('')
    } catch (error) {
      console.error('Error sending message:', error)
    }
  }

  const handleTyping = () => {
    supabase
      .channel('typing')
      .send({
        type: 'broadcast',
        event: 'typing',
        payload: { userId: user?.id }
      })
  }

  const formatTime = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="w-8 h-8 border-t-2 border-[#FFB900] rounded-full animate-spin"></div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-[90vh] bg-background">
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-3xl mx-auto space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex items-start gap-3 ${
                message.sender_id === user?.id ? 'flex-row-reverse' : ''
              }`}
            >
              <div className="w-8 h-8 rounded-full bg-gray-700 flex-shrink-0 overflow-hidden">
                {message.sender_avatar ? (
                  <Image
                    src={message.sender_avatar}
                    alt={message.sender_name}
                    width={32}
                    height={32}
                    className="object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-white">
                    {message.sender_name.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              
              <div
                className={`max-w-[70%] ${
                  message.sender_id === user?.id
                    ? 'bg-[#FFB900] text-black'
                    : 'bg-[#1A1A1A] text-white'
                } rounded-lg p-3`}
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-sm font-medium">
                    {message.sender_id === user?.id ? 'You' : message.sender_name}
                  </span>
                  <span className="text-xs opacity-70">
                    {formatTime(message.created_at)}
                  </span>
                </div>
                <p className="text-sm whitespace-pre-wrap">{message.content}</p>
              </div>
            </div>
          ))}
          {isTyping && (
            <div className="text-sm text-gray-400 italic">
              Someone is typing...
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>
      
      <div className="border-t border-white/10 p-4">
        <form onSubmit={handleSendMessage} className="max-w-3xl mx-auto">
          <div className="flex gap-4">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={handleTyping}
              placeholder="Type your message..."
              className="flex-1 bg-[#1A1A1A] border border-white/10 rounded-lg px-4 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#FFB900] focus:border-transparent"
            />
            <button
              type="submit"
              disabled={!newMessage.trim()}
              className="bg-[#FFB900] text-black px-6 py-2 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#FFC933] transition-colors"
            >
              Send
            </button>
          </div>
        </form>
      </div>
    </div>
  )
} 