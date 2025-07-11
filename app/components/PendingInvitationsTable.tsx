'use client'

import { useState } from 'react'
import { Invitation } from '../../types/database'
import { XMarkIcon } from '@heroicons/react/24/outline'

interface PendingInvitationsTableProps {
  invitations: Invitation[]
  onDeleteInvitation: (invitationId: string) => void
}

export default function PendingInvitationsTable({ 
  invitations, 
  onDeleteInvitation 
}: PendingInvitationsTableProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatExpiry = (expiresAt?: string) => {
    if (!expiresAt) return 'No expiry'
    
    const now = new Date()
    const expiry = new Date(expiresAt)
    const diffInHours = Math.floor((expiry.getTime() - now.getTime()) / (1000 * 60 * 60))
    
    if (diffInHours < 0) return 'Expired'
    if (diffInHours < 24) return `${diffInHours}h left`
    return `${Math.floor(diffInHours / 24)}d left`
  }

  const handleDelete = async (invitationId: string, email: string) => {
    if (!confirm(`Are you sure you want to delete the invitation for ${email}?`)) {
      return
    }

    setDeletingId(invitationId)
    try {
      await onDeleteInvitation(invitationId)
    } finally {
      setDeletingId(null)
    }
  }

  if (invitations.length === 0) {
    return (
      <div className="bg-white/5 rounded-lg p-8 text-center">
        <div className="text-gray-400 mb-2">No pending invitations</div>
        <div className="text-sm text-gray-500">All invitations have been completed or expired</div>
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
                Email
              </th>
              <th className="px-6 py-4 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                Tag
              </th>
              <th className="px-6 py-4 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                Invited
              </th>
              <th className="px-6 py-4 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                Expires
              </th>
              <th className="px-6 py-4 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {invitations.map((invitation) => (
              <tr key={invitation.id} className="hover:bg-white/5 transition-colors">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-white">
                    {invitation.email}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="text-gray-400 text-sm">-</span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                  {formatDate(invitation.created_at)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`text-sm ${
                    invitation.expires_at && new Date(invitation.expires_at) < new Date()
                      ? 'text-red-400'
                      : 'text-gray-400'
                  }`}>
                    {formatExpiry(invitation.expires_at)}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <button
                    onClick={() => handleDelete(invitation.id, invitation.email)}
                    disabled={deletingId === invitation.id}
                    className="text-red-400 hover:text-red-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Delete invitation"
                  >
                    {deletingId === invitation.id ? (
                      <div className="w-5 h-5 border-t-2 border-red-400 rounded-full animate-spin"></div>
                    ) : (
                      <XMarkIcon className="w-5 h-5" />
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