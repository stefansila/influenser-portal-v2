'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Tag } from '../../types/database'
import { showToastConfirm } from './ToastConfirm'
import AlertUtils from './AlertUtils'

interface TagManagerProps {
  tags: Tag[]
  onClose: () => void
  onTagsChange: () => void
}

export default function TagManager({ tags, onClose, onTagsChange }: TagManagerProps) {
  const [newTagName, setNewTagName] = useState('')
  const [newTagColor, setNewTagColor] = useState('#FFB900')
  const [editingTag, setEditingTag] = useState<Tag | null>(null)
  const [loading, setLoading] = useState(false)

  const predefinedColors = [
    '#FFB900', '#10B981', '#EF4444', '#8B5CF6', '#06B6D4',
    '#F59E0B', '#84CC16', '#EC4899', '#6366F1', '#14B8A6'
  ]

  const handleCreateTag = async () => {
    if (!newTagName.trim()) return

    try {
      setLoading(true)
      const { error } = await supabase
        .from('tags')
        .insert([{
          name: newTagName.trim(),
          color: newTagColor
        }])

      if (error) throw error

      AlertUtils.success('Tag Created', `"${newTagName.trim()}" has been successfully created`)
      setNewTagName('')
      setNewTagColor('#FFB900')
      onTagsChange()
    } catch (error) {
      console.error('Error creating tag:', error)
      AlertUtils.error('Error', 'Failed to create tag. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateTag = async () => {
    if (!editingTag || !editingTag.name.trim()) return

    try {
      setLoading(true)
      const { error } = await supabase
        .from('tags')
        .update({
          name: editingTag.name.trim(),
          color: editingTag.color,
          updated_at: new Date().toISOString()
        })
        .eq('id', editingTag.id)

      if (error) throw error

      AlertUtils.success('Tag Updated', `"${editingTag.name.trim()}" has been successfully updated`)
      setEditingTag(null)
      onTagsChange()
    } catch (error) {
      console.error('Error updating tag:', error)
      AlertUtils.error('Error', 'Failed to update tag. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteTag = async (tagId: string, tagName: string) => {
    showToastConfirm({
      title: 'Delete Tag',
      message: `Are you sure you want to delete "${tagName}"? This will remove it from all users.`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      isDestructive: true,
      onConfirm: async () => {
        try {
          setLoading(true)
          const { error } = await supabase
            .from('tags')
            .delete()
            .eq('id', tagId)

          if (error) throw error

          AlertUtils.success('Tag Deleted', `"${tagName}" has been successfully deleted`)
          onTagsChange()
        } catch (error) {
          console.error('Error deleting tag:', error)
          AlertUtils.error('Error', 'Failed to delete tag. Please try again.')
        } finally {
          setLoading(false)
        }
      }
    })
  }

  // Close modal on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (editingTag) {
          setEditingTag(null)
        } else {
          onClose()
        }
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [editingTag, onClose])

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-[#1a1a1a] rounded-lg border border-white/10 w-full max-w-2xl max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <h3 className="text-lg font-semibold text-white">Manage Tags</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(80vh-120px)]">
          {/* Create New Tag */}
          <div className="mb-6">
            <h4 className="text-white font-medium mb-3">Create New Tag</h4>
            <div className="space-y-3">
              <div>
                <input
                  type="text"
                  placeholder="Tag name"
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#FFB900] focus:border-transparent"
                  onKeyPress={(e) => e.key === 'Enter' && handleCreateTag()}
                />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm text-gray-300">Color:</span>
                  <div 
                    className="w-6 h-6 rounded-full border-2 border-white/20"
                    style={{ backgroundColor: newTagColor }}
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  {predefinedColors.map((color) => (
                    <button
                      key={color}
                      onClick={() => setNewTagColor(color)}
                      className={`w-8 h-8 rounded-full border-2 transition-all ${
                        newTagColor === color ? 'border-white scale-110' : 'border-white/20 hover:border-white/40'
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>
              <button
                onClick={handleCreateTag}
                disabled={!newTagName.trim() || loading}
                className="px-4 py-2 bg-[#FFB900] text-black rounded-lg hover:bg-[#FFB900]/90 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Creating...' : 'Create Tag'}
              </button>
            </div>
          </div>

          {/* Existing Tags */}
          <div>
            <h4 className="text-white font-medium mb-3">Existing Tags ({tags.length})</h4>
            <div className="space-y-2">
              {tags.map((tag) => (
                <div key={tag.id} className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                  {editingTag?.id === tag.id ? (
                    <div className="flex items-center gap-3 flex-1">
                      <input
                        type="text"
                        value={editingTag.name}
                        onChange={(e) => setEditingTag({ ...editingTag, name: e.target.value })}
                        className="flex-1 px-2 py-1 bg-white/10 border border-white/20 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#FFB900]"
                        onKeyPress={(e) => e.key === 'Enter' && handleUpdateTag()}
                      />
                      <div className="flex gap-1">
                        {predefinedColors.map((color) => (
                          <button
                            key={color}
                            onClick={() => setEditingTag({ ...editingTag, color })}
                            className={`w-6 h-6 rounded-full border transition-all ${
                              editingTag.color === color ? 'border-white scale-110' : 'border-white/20'
                            }`}
                            style={{ backgroundColor: color }}
                          />
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={handleUpdateTag}
                          disabled={loading}
                          className="text-green-400 hover:text-green-300 disabled:opacity-50"
                        >
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        </button>
                        <button
                          onClick={() => setEditingTag(null)}
                          className="text-gray-400 hover:text-white"
                        >
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-3">
                        <div 
                          className="w-4 h-4 rounded-full"
                          style={{ backgroundColor: tag.color }}
                        />
                        <span className="text-white font-medium">{tag.name}</span>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setEditingTag(tag)}
                          className="text-gray-400 hover:text-white transition-colors"
                        >
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDeleteTag(tag.id, tag.name)}
                          disabled={loading}
                          className="text-red-400 hover:text-red-300 transition-colors disabled:opacity-50"
                        >
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
              
              {tags.length === 0 && (
                <div className="text-center py-8">
                  <div className="text-gray-400 mb-2">No tags created yet</div>
                  <div className="text-sm text-gray-500">Create your first tag above</div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-white/10">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
} 