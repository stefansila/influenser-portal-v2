'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { Tag } from '../../types/database'

type TagSelectorProps = {
  selectedTags: string[]
  onChange: (tagIds: string[]) => void
  onUsersFromTagsChange: (userIds: string[]) => void
}

export default function TagSelector({ selectedTags, onChange, onUsersFromTagsChange }: TagSelectorProps) {
  const [tags, setTags] = useState<Tag[]>([])
  const [loading, setLoading] = useState(true)
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    const fetchTags = async () => {
      setLoading(true)
      try {
        const { data, error } = await supabase
          .from('tags')
          .select('*')
          .order('name')
        
        if (error) {
          console.error('Error fetching tags:', error)
          return
        }
        
        setTags(data || [])
      } catch (error) {
        console.error('Error:', error)
      } finally {
        setLoading(false)
      }
    }
    
    fetchTags()
  }, [])

  // Fetch users when selected tags change
  useEffect(() => {
    const fetchUsersWithSelectedTags = async () => {
      if (selectedTags.length === 0) {
        onUsersFromTagsChange([])
        return
      }

      try {
        // Fetch users who have any of the selected tags
        const { data, error } = await supabase
          .from('user_tags')
          .select('user_id')
          .in('tag_id', selectedTags)
        
        if (error) {
          console.error('Error fetching users with tags:', error)
          return
        }
        
        // Get unique user IDs
        const userIds = Array.from(new Set(data?.map(item => item.user_id) || []))
        onUsersFromTagsChange(userIds)
      } catch (error) {
        console.error('Error:', error)
      }
    }
    
    fetchUsersWithSelectedTags()
  }, [selectedTags])

  const toggleTag = (tagId: string) => {
    if (selectedTags.includes(tagId)) {
      onChange(selectedTags.filter(id => id !== tagId))
    } else {
      onChange([...selectedTags, tagId])
    }
  }

  const clearAllTags = () => {
    onChange([])
  }

  return (
    <div className="relative">
      <div className="mb-2 flex justify-between items-center">
        <label className="block text-sm text-[#FFB900]">
          Select Tags (Auto-select users with these tags)
        </label>
        <span className="text-sm text-gray-400">
          {selectedTags.length} tag{selectedTags.length !== 1 ? 's' : ''} selected
        </span>
      </div>
      
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex justify-between items-center px-3 py-3 rounded-lg bg-[rgba(255,255,255,0.04)] border border-white/20 focus:outline-none text-white"
      >
        <span>
          {selectedTags.length === 0 && 'Select tags to auto-select users'}
          {selectedTags.length > 0 && selectedTags.length < 3 && 
            tags
              .filter(t => selectedTags.includes(t.id))
              .map(t => t.name)
              .join(', ')
          }
          {selectedTags.length >= 3 && `${selectedTags.length} tags selected`}
        </span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M6 9L12 15L18 9" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
      
      {isOpen && (
        <div className="absolute z-10 mt-1 w-full bg-[#1A1A1A] rounded-md shadow-lg border border-white/10 max-h-64 overflow-y-auto">
          {selectedTags.length > 0 && (
            <div className="p-2 border-b border-white/10">
              <button
                onClick={clearAllTags}
                className="w-full text-left py-1 px-2 rounded hover:bg-white/5 text-red-400 text-sm"
              >
                Clear all tags
              </button>
            </div>
          )}
          
          <div className="py-1">
            {loading ? (
              <div className="p-3 text-center text-gray-400">Loading tags...</div>
            ) : tags.length === 0 ? (
              <div className="p-3 text-center text-gray-400">No tags found</div>
            ) : (
              tags.map(tag => (
                <label
                  key={tag.id}
                  className="flex items-center space-x-2 py-2 px-3 hover:bg-white/5 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedTags.includes(tag.id)}
                    onChange={() => toggleTag(tag.id)}
                    className="rounded border-white/20 text-[#FFB900] focus:ring-[#FFB900]"
                  />
                  <div className="flex items-center space-x-2">
                    <div 
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: tag.color }}
                    />
                    <span className="text-white">{tag.name}</span>
                  </div>
                </label>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
} 