'use client'

import { useState } from 'react'
import Image from 'next/image'
import { UserWithTags, Tag } from '../../types/database'
import InlineTagEditor from './InlineTagEditor'

interface UserTableProps {
  users: UserWithTags[]
  tags: Tag[]
  onTagsUpdate: (userId: string, tagIds: string[]) => void
  onCreateTag: (name: string, color: string) => Promise<Tag>
  onDeleteUser: (userId: string) => void
}

export default function UserTable({ users, tags, onTagsUpdate, onCreateTag, onDeleteUser }: UserTableProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const formatLastActivity = (lastActivity?: string, createdAt?: string) => {
    const date = lastActivity || createdAt
    if (!date) return 'Never'
    
    const now = new Date()
    const activityDate = new Date(date)
    const diffInHours = Math.floor((now.getTime() - activityDate.getTime()) / (1000 * 60 * 60))
    
    if (diffInHours < 1) return 'Just now'
    if (diffInHours < 24) return `${diffInHours}h ago`
    if (diffInHours < 168) return `${Math.floor(diffInHours / 24)}d ago`
    return formatDate(date)
  }

  const getRoleColor = (role: string) => {
    return role === 'admin' ? 'text-[#FFB900]' : 'text-gray-400'
  }

  const getRoleBadge = (role: string) => {
    return role === 'admin' 
      ? 'bg-[#FFB900]/20 text-[#FFB900] border-[#FFB900]/30'
      : 'bg-gray-500/20 text-gray-400 border-gray-500/30'
  }

  const handleDeleteUser = async (userId: string, userEmail: string) => {
    if (!confirm(`Are you sure you want to delete user ${userEmail}? This will permanently delete all their data.`)) {
      return
    }

    setDeletingId(userId)
    try {
      await onDeleteUser(userId)
    } finally {
      setDeletingId(null)
    }
  }

  if (users.length === 0) {
    return (
      <div className="bg-white/5 rounded-lg p-8 text-center">
        <div className="text-gray-400 mb-2">No users found</div>
        <div className="text-sm text-gray-500">Try adjusting your search or filters</div>
      </div>
    )
  }

  return (
    <div className="bg-white/5 rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-white/5">
            <tr>
              <th className="px-6 py-4 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                User
              </th>
              <th className="px-6 py-4 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                Role
              </th>
              <th className="px-6 py-4 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                Last Activity
              </th>
              <th className="px-6 py-4 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                Joined
              </th>
              <th className="px-6 py-4 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                Tags
              </th>
              <th className="px-6 py-4 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {users.map((user) => (
              <tr key={user.id} className="hover:bg-white/5 transition-colors">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="flex-shrink-0 h-10 w-10">
                      {user.avatar_url ? (
                        <Image
                          src={user.avatar_url}
                          alt={user.full_name || user.email}
                          width={40}
                          height={40}
                          className="h-10 w-10 rounded-full object-cover"
                        />
                      ) : (
                        <div className="h-10 w-10 rounded-full bg-gray-600 flex items-center justify-center">
                          <span className="text-sm font-medium text-white">
                            {(user.full_name || user.email).charAt(0).toUpperCase()}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="ml-4">
                      <div className="text-sm font-medium text-white">
                        {user.full_name || 'No name'}
                      </div>
                      <div className="text-sm text-gray-400">
                        {user.email}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full border ${getRoleBadge(user.role)}`}>
                    {user.role}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                  {formatLastActivity(user.last_activity, user.created_at)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                  {formatDate(user.created_at)}
                </td>
                <td className="px-6 py-4">
                  <InlineTagEditor
                    userTags={user.tags}
                    allTags={tags}
                    onAddTag={async (tagName) => {
                      try {
                        console.log('Adding tag to user:', { tagName, userId: user.id })
                        // Check if tag already exists
                        const existingTag = tags.find(t => t.name.toLowerCase() === tagName.toLowerCase())
                        if (existingTag) {
                          console.log('Using existing tag:', existingTag)
                          // Add existing tag to user
                          const newTagIds = [...user.tags.map(t => t.id), existingTag.id]
                          await onTagsUpdate(user.id, newTagIds)
                        } else {
                          console.log('Creating new tag:', tagName)
                          // Create new tag and add to user
                          const colors = ['#FFB900', '#10B981', '#EF4444', '#8B5CF6', '#06B6D4', '#F59E0B', '#EF4444', '#10B981']
                          const randomColor = colors[Math.floor(Math.random() * colors.length)]
                          const newTag = await onCreateTag(tagName, randomColor)
                          console.log('New tag created, adding to user:', newTag)
                          const newTagIds = [...user.tags.map(t => t.id), newTag.id]
                          await onTagsUpdate(user.id, newTagIds)
                        }
                      } catch (error) {
                        console.error('Error in onAddTag:', error)
                        alert('Failed to add tag: ' + ((error as any)?.message || 'Unknown error'))
                      }
                    }}
                    onRemoveTag={(tagId) => {
                      const newTagIds = user.tags.filter(t => t.id !== tagId).map(t => t.id)
                      onTagsUpdate(user.id, newTagIds)
                    }}
                  />
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <button
                    onClick={() => handleDeleteUser(user.id, user.email)}
                    disabled={deletingId === user.id}
                    className="text-red-400 hover:text-red-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Delete user"
                  >
                    {deletingId === user.id ? (
                      <div className="w-5 h-5 border-t-2 border-red-400 rounded-full animate-spin"></div>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    )}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>


    </div>
  )
} 