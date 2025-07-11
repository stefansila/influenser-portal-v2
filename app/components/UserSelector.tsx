'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

type User = {
  id: string
  email: string
  full_name: string | null
}

type UserSelectorProps = {
  selectedUsers: string[]
  onChange: (userIds: string[]) => void
  usersFromTags?: string[]
}

export default function UserSelector({ selectedUsers, onChange, usersFromTags = [] }: UserSelectorProps) {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    const fetchUsers = async () => {
      setLoading(true)
      try {
        // Fetch all regular users (not admins)
        const { data, error } = await supabase
          .from('users')
          .select('id, email, full_name')
          .eq('role', 'user')
          .order('email')
        
        if (error) {
          console.error('Error fetching users:', error)
          return
        }
        
        setUsers(data || [])
      } catch (error) {
        console.error('Error:', error)
      } finally {
        setLoading(false)
      }
    }
    
    fetchUsers()
  }, [])

  // Auto-select users from tags
  useEffect(() => {
    if (usersFromTags.length > 0) {
      // Merge users from tags with already selected users, avoiding duplicates
      const newSelectedUsers = Array.from(new Set([...selectedUsers, ...usersFromTags]))
      if (newSelectedUsers.length !== selectedUsers.length || 
          !usersFromTags.every(id => selectedUsers.includes(id))) {
        onChange(newSelectedUsers)
      }
    } else if (usersFromTags.length === 0 && selectedUsers.length > 0) {
      // When tags are cleared, we don't automatically remove users
      // Admin can manually remove them if needed
    }
  }, [usersFromTags])

  const toggleUser = (userId: string) => {
    if (selectedUsers.includes(userId)) {
      onChange(selectedUsers.filter(id => id !== userId))
    } else {
      onChange([...selectedUsers, userId])
    }
  }

  const toggleAll = () => {
    if (selectedUsers.length === users.length) {
      onChange([])
    } else {
      onChange(users.map(user => user.id))
    }
  }

  const filteredUsers = users.filter(user => 
    user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (user.full_name && user.full_name.toLowerCase().includes(searchTerm.toLowerCase()))
  )

  return (
    <div className="relative">
      <div className="mb-2 flex justify-between items-center">
        <label className="block text-sm text-[#FFB900]">
          Select Users to View Proposal
        </label>
        <span className="text-sm text-gray-400">
          {selectedUsers.length} of {users.length} selected
        </span>
      </div>
      
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex justify-between items-center px-3 py-3 rounded-lg bg-[rgba(255,255,255,0.04)] border border-white/20 focus:outline-none text-white"
      >
        <span>
          {selectedUsers.length === 0 && 'Select users'}
          {selectedUsers.length > 0 && selectedUsers.length < 3 && 
            users
              .filter(u => selectedUsers.includes(u.id))
              .map(u => u.email)
              .join(', ')
          }
          {selectedUsers.length >= 3 && `${selectedUsers.length} users selected`}
        </span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M6 9L12 15L18 9" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
      
      {isOpen && (
        <div className="absolute z-10 mt-1 w-full bg-[#1A1A1A] rounded-md shadow-lg border border-white/10 max-h-96 overflow-y-auto">
          <div className="p-2 border-b border-white/10">
            <input
              type="text"
              placeholder="Search users..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2 rounded-md bg-[#121212] border border-white/20 focus:outline-none text-white text-sm"
            />
          </div>
          
          <div className="p-2 border-b border-white/10">
            <label className="flex items-center space-x-2 py-1 px-2 rounded hover:bg-white/5 cursor-pointer">
              <input
                type="checkbox"
                checked={selectedUsers.length === users.length}
                onChange={toggleAll}
                className="rounded border-white/20 text-[#FFB900] focus:ring-[#FFB900]"
              />
              <span className="text-white">Select All</span>
            </label>
          </div>
          
          <div className="py-1">
            {loading ? (
              <div className="p-3 text-center text-gray-400">Loading users...</div>
            ) : filteredUsers.length === 0 ? (
              <div className="p-3 text-center text-gray-400">No users found</div>
            ) : (
              filteredUsers.map(user => {
                const isFromTag = usersFromTags.includes(user.id)
                return (
                  <label
                    key={user.id}
                    className="flex items-center space-x-2 py-2 px-3 hover:bg-white/5 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedUsers.includes(user.id)}
                      onChange={() => toggleUser(user.id)}
                      className="rounded border-white/20 text-[#FFB900] focus:ring-[#FFB900]"
                    />
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <span className="text-white">{user.email}</span>
                        {isFromTag && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-[#FFB900]/20 text-[#FFB900] border border-[#FFB900]/30">
                            Tag
                          </span>
                        )}
                      </div>
                      {user.full_name && (
                        <div className="text-xs text-gray-400">{user.full_name}</div>
                      )}
                    </div>
                  </label>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
} 