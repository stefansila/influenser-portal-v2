'use client'

import { useState } from 'react'
import { Tag } from '../../types/database'

interface UserFiltersProps {
  tags: Tag[]
  selectedTags: string[]
  onTagsChange: (tagIds: string[]) => void
  sortBy: 'name' | 'recent' | 'created'
  onSortChange: (sort: 'name' | 'recent' | 'created') => void
}

export default function UserFilters({ 
  tags, 
  selectedTags, 
  onTagsChange, 
  sortBy, 
  onSortChange 
}: UserFiltersProps) {
  const [showTagDropdown, setShowTagDropdown] = useState(false)

  const handleTagToggle = (tagId: string) => {
    if (selectedTags.includes(tagId)) {
      onTagsChange(selectedTags.filter(id => id !== tagId))
    } else {
      onTagsChange([...selectedTags, tagId])
    }
  }

  const clearAllTags = () => {
    onTagsChange([])
    setShowTagDropdown(false)
  }

  return (
    <div className="space-y-4">
      {/* Sort Options */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Sort by
        </label>
        <select
          value={sortBy}
          onChange={(e) => onSortChange(e.target.value as 'name' | 'recent' | 'created')}
          className="select-field focus:ring-2 focus:ring-[#FFB900] focus:border-transparent"
        >
          <option value="name">Name (A-Z)</option>
          <option value="recent">Recently Used</option>
          <option value="created">Recently Created</option>
        </select>
      </div>

      {/* Tag Filters */}
      <div className="relative">
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Filter by Tags
        </label>
        <button
          onClick={() => setShowTagDropdown(!showTagDropdown)}
          className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-left focus:outline-none focus:ring-2 focus:ring-[#FFB900] focus:border-transparent flex items-center justify-between"
        >
          <span>
            {selectedTags.length === 0 
              ? 'All tags' 
              : `${selectedTags.length} tag${selectedTags.length > 1 ? 's' : ''} selected`
            }
          </span>
          <svg 
            className={`h-5 w-5 transition-transform ${showTagDropdown ? 'rotate-180' : ''}`}
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {showTagDropdown && (
          <div className="absolute z-10 w-full mt-1 bg-[#1a1a1a] border border-white/10 rounded-lg shadow-lg max-h-60 overflow-y-auto">
            <div className="p-2">
              <button
                onClick={clearAllTags}
                className="w-full text-left px-3 py-2 text-sm text-gray-400 hover:text-white hover:bg-white/5 rounded"
              >
                Clear all filters
              </button>
            </div>
            <div className="border-t border-white/10">
              {tags.map((tag) => (
                <label
                  key={tag.id}
                  className="flex items-center px-3 py-2 hover:bg-white/5 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedTags.includes(tag.id)}
                    onChange={() => handleTagToggle(tag.id)}
                    className="mr-3 rounded border-gray-300 text-[#FFB900] focus:ring-[#FFB900]"
                  />
                  <div className="flex items-center">
                    <div 
                      className="w-3 h-3 rounded-full mr-2"
                      style={{ backgroundColor: tag.color }}
                    />
                    <span className="text-sm text-white">{tag.name}</span>
                  </div>
                </label>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Selected Tags Display */}
      {selectedTags.length > 0 && (
        <div>
          <div className="flex flex-wrap gap-2">
            {selectedTags.map((tagId) => {
              const tag = tags.find(t => t.id === tagId)
              if (!tag) return null
              
              return (
                <span
                  key={tagId}
                  className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-white/10 text-white"
                >
                  <div 
                    className="w-2 h-2 rounded-full mr-1"
                    style={{ backgroundColor: tag.color }}
                  />
                  {tag.name}
                  <button
                    onClick={() => handleTagToggle(tagId)}
                    className="ml-1 text-gray-400 hover:text-white"
                  >
                    <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </span>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
} 