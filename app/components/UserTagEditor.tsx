'use client'

import { useState, useEffect } from 'react'
import { UserWithTags, Tag } from '../../types/database'

interface UserTagEditorProps {
  user: UserWithTags
  tags: Tag[]
  onClose: () => void
  onSave: (tagIds: string[]) => void
}

export default function UserTagEditor({ user, tags, onClose, onSave }: UserTagEditorProps) {
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>(
    user.tags.map(tag => tag.id)
  )

  const handleTagToggle = (tagId: string) => {
    if (selectedTagIds.includes(tagId)) {
      setSelectedTagIds(selectedTagIds.filter(id => id !== tagId))
    } else {
      setSelectedTagIds([...selectedTagIds, tagId])
    }
  }

  const handleSave = () => {
    onSave(selectedTagIds)
  }

  // Close modal on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [onClose])

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-[#1a1a1a] rounded-lg border border-white/10 w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <div>
            <h3 className="text-lg font-semibold text-white">Edit User Tags</h3>
            <p className="text-sm text-gray-400 mt-1">
              {user.full_name || user.email}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="space-y-3 max-h-60 overflow-y-auto">
            {tags.map((tag) => (
              <label
                key={tag.id}
                className="flex items-center p-3 rounded-lg hover:bg-white/5 cursor-pointer transition-colors"
              >
                <input
                  type="checkbox"
                  checked={selectedTagIds.includes(tag.id)}
                  onChange={() => handleTagToggle(tag.id)}
                  className="mr-3 rounded border-gray-300 text-[#FFB900] focus:ring-[#FFB900] focus:ring-offset-0"
                />
                <div className="flex items-center">
                  <div 
                    className="w-4 h-4 rounded-full mr-3"
                    style={{ backgroundColor: tag.color }}
                  />
                  <span className="text-white font-medium">{tag.name}</span>
                </div>
              </label>
            ))}
          </div>

          {tags.length === 0 && (
            <div className="text-center py-8">
              <div className="text-gray-400 mb-2">No tags available</div>
              <div className="text-sm text-gray-500">Create some tags first to assign them to users</div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-white/10">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-[#FFB900] text-black rounded-lg hover:bg-[#FFB900]/90 transition-colors font-medium"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  )
} 