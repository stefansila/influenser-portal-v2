'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { User, Tag, UserWithTags, Invitation } from '../../../types/database'
import UserTable from '../../../app/components/UserTable'
import UserFilters from '../../../app/components/UserFilters'
import UserSearch from '../../../app/components/UserSearch'
import TagManager from '../../../app/components/TagManager'
import PendingInvitationsTable from '../../../app/components/PendingInvitationsTable'

export default function UsersPage() {
  const { user, isLoading: authLoading } = useAuth()
  const router = useRouter()
  const [users, setUsers] = useState<UserWithTags[]>([])
  const [tags, setTags] = useState<Tag[]>([])
  const [pendingInvitations, setPendingInvitations] = useState<Invitation[]>([])
  const [loading, setLoading] = useState(false)
  const [invitationsLoading, setInvitationsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [sortBy, setSortBy] = useState<'name' | 'recent' | 'created'>('name')
  const [showTagManager, setShowTagManager] = useState(false)

  // Check admin status and fetch data
  useEffect(() => {
    const checkAdminStatusAndFetchData = async () => {
      if (!user) return
      
      try {
        // Check if user is an admin
        const { data, error } = await supabase
          .from('users')
          .select('role')
          .eq('id', user.id)
          .single()
        
        if (error || data?.role !== 'admin') {
          // Not an admin, redirect to user dashboard
          router.push('/dashboard')
          return
        }
        
        // User is admin, fetch data
        await Promise.all([
          fetchUsers(),
          fetchTags(),
          fetchPendingInvitations()
        ])
      } catch (error) {
        console.error('Error in admin check:', error)
        router.push('/dashboard')
      }
    }
    
    if (user && !authLoading) {
      checkAdminStatusAndFetchData()
    }
  }, [user, authLoading, router])

  const fetchUsers = async () => {
    try {
      // Only set loading if we don't have users yet
      if (users.length === 0) {
        setLoading(true)
      }
      
      // Fetch users with their tags
      const { data: usersData, error: usersError } = await supabase
        .from('users')
        .select(`
          *,
          user_tags (
            tag_id,
            tags (
              id,
              name,
              color
            )
          )
        `)
        .order('created_at', { ascending: false })

      if (usersError) throw usersError

      // Transform the data to include tags array
      const usersWithTags: UserWithTags[] = usersData?.map(user => ({
        ...user,
        tags: user.user_tags?.map((ut: any) => ut.tags) || []
      })) || []

      setUsers(usersWithTags)
    } catch (error) {
      console.error('Error fetching users:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchTags = async () => {
    try {
      const { data, error } = await supabase
        .from('tags')
        .select('*')
        .order('name')

      if (error) throw error
      setTags(data || [])
    } catch (error) {
      console.error('Error fetching tags:', error)
    }
  }

  const handleTagsUpdate = async (userId: string, tagIds: string[]) => {
    try {
      // Remove existing tags for this user
      await supabase
        .from('user_tags')
        .delete()
        .eq('user_id', userId)

      // Add new tags
      if (tagIds.length > 0) {
        const userTags = tagIds.map(tagId => ({
          user_id: userId,
          tag_id: tagId
        }))

        await supabase
          .from('user_tags')
          .insert(userTags)
      }

      // Refresh users data
      await fetchUsers()
    } catch (error) {
      console.error('Error updating user tags:', error)
    }
  }

  const handleCreateTag = async (name: string, color: string): Promise<Tag> => {
    try {
      console.log('Creating tag:', { name, color })
      const { data, error } = await supabase
        .from('tags')
        .insert({ name, color })
        .select()
        .single()

      if (error) {
        console.error('Supabase error creating tag:', error)
        throw error
      }

      console.log('Tag created successfully:', data)
      // Update tags list immediately for better UX
      setTags(prevTags => [...prevTags, data])
      
      return data
    } catch (error) {
      console.error('Error creating tag:', error)
      console.error('Error details:', JSON.stringify(error, null, 2))
      throw error
    }
  }

  const fetchPendingInvitations = async () => {
    try {
      setInvitationsLoading(true)
      const response = await fetch('/api/admin/pending-invitations')
      const result = await response.json()
      
      if (result.success) {
        setPendingInvitations(result.invitations || [])
      } else {
        console.error('Error fetching pending invitations:', result.error)
      }
    } catch (error) {
      console.error('Error fetching pending invitations:', error)
    } finally {
      setInvitationsLoading(false)
    }
  }



  const handleDeleteUser = async (userId: string) => {
    try {
      const response = await fetch('/api/admin/delete-user', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId }),
      })

      const result = await response.json()

      if (result.success) {
        // Remove user from local state
        setUsers(prevUsers => prevUsers.filter(user => user.id !== userId))
        alert('User deleted successfully')
      } else {
        throw new Error(result.error || 'Failed to delete user')
      }
    } catch (error: any) {
      console.error('Error deleting user:', error)
      alert('Failed to delete user: ' + error.message)
    }
  }

  const handleDeleteInvitation = async (invitationId: string) => {
    try {
      const response = await fetch('/api/admin/delete-invitation', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ invitationId }),
      })

      const result = await response.json()

      if (result.success) {
        // Remove invitation from local state
        setPendingInvitations(prevInvitations => 
          prevInvitations.filter(invitation => invitation.id !== invitationId)
        )
        alert('Invitation deleted successfully')
      } else {
        throw new Error(result.error || 'Failed to delete invitation')
      }
    } catch (error: any) {
      console.error('Error deleting invitation:', error)
      alert('Failed to delete invitation: ' + error.message)
    }
  }

  const filteredAndSortedUsers = users
    .filter(user => {
      // Search filter
      const matchesSearch = !searchTerm || 
        user.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email.toLowerCase().includes(searchTerm.toLowerCase())

      // Tag filter
      const matchesTags = selectedTags.length === 0 || 
        selectedTags.some(tagId => user.tags.some((tag: Tag) => tag.id === tagId))

      return matchesSearch && matchesTags
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'name':
          const nameA = a.full_name || a.email
          const nameB = b.full_name || b.email
          return nameA.localeCompare(nameB)
        case 'recent':
          const dateA = new Date(a.last_activity || a.created_at)
          const dateB = new Date(b.last_activity || b.created_at)
          return dateB.getTime() - dateA.getTime()
        case 'created':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        default:
          return 0
      }
    })

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-t-2 border-[#FFB900] rounded-full animate-spin"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6 users-wrapper">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Users Management</h1>
          <p className="text-gray-400 mt-1">
            Manage users, assign tags, and track activity
          </p>
        </div>
        <button
          onClick={() => setShowTagManager(true)}
          className="px-4 py-2 bg-[#FFB900] text-black rounded-lg hover:bg-[#FFB900]/90 transition-colors font-medium"
        >
          Manage Tags
        </button>
      </div>

      {/* Search and Filters */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <UserSearch 
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
          />
        </div>
        <div>
          <UserFilters
            tags={tags}
            selectedTags={selectedTags}
            onTagsChange={setSelectedTags}
            sortBy={sortBy}
            onSortChange={setSortBy}
          />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white/5 rounded-lg p-4">
          <div className="text-2xl font-bold text-white">{users.length}</div>
          <div className="text-gray-400 text-sm">Total Users</div>
        </div>
        <div className="bg-white/5 rounded-lg p-4">
          <div className="text-2xl font-bold text-white">{filteredAndSortedUsers.length}</div>
          <div className="text-gray-400 text-sm">Filtered Results</div>
        </div>
        <div className="bg-white/5 rounded-lg p-4">
          <div className="text-2xl font-bold text-white">
            {users.filter(u => u.role === 'admin').length}
          </div>
          <div className="text-gray-400 text-sm">Admins</div>
        </div>
        <div className="bg-white/5 rounded-lg p-4">
          <div className="text-2xl font-bold text-white">{pendingInvitations.length}</div>
          <div className="text-gray-400 text-sm">Pending Invites</div>
        </div>
      </div>

      {/* Users Table */}
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold text-white mb-4">Registered Users</h2>
          <UserTable 
            users={filteredAndSortedUsers}
            tags={tags}
            onTagsUpdate={handleTagsUpdate}
            onCreateTag={handleCreateTag}
            onDeleteUser={handleDeleteUser}
          />
        </div>

        {/* Pending Invitations Table */}
        <div>
          <h2 className="text-xl font-semibold text-white mb-4">Pending Invitations</h2>
          {invitationsLoading ? (
            <div className="flex items-center justify-center min-h-[200px]">
              <div className="w-8 h-8 border-t-2 border-[#FFB900] rounded-full animate-spin"></div>
            </div>
          ) : (
            <PendingInvitationsTable
              invitations={pendingInvitations}
              onDeleteInvitation={handleDeleteInvitation}
            />
          )}
        </div>
      </div>

      {/* Tag Manager Modal */}
      {showTagManager && (
        <TagManager
          tags={tags}
          onClose={() => setShowTagManager(false)}
          onTagsChange={fetchTags}
        />
      )}
    </div>
  )
} 