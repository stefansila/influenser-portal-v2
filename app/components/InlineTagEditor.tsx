'use client'

import { useState, useRef, useEffect } from 'react'
import { Tag } from '../../types/database'

interface InlineTagEditorProps {
  userTags: Tag[]
  allTags: Tag[]
  onAddTag: (tagName: string) => void
  onRemoveTag: (tagId: string) => void
}

export default function InlineTagEditor({ 
  userTags, 
  allTags, 
  onAddTag, 
  onRemoveTag 
}: InlineTagEditorProps) {
  const [inputValue, setInputValue] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Filter suggestions based on input and exclude already assigned tags
  const suggestions = allTags.filter(tag => 
    tag.name.toLowerCase().includes(inputValue.toLowerCase()) &&
    !userTags.some(userTag => userTag.id === tag.id)
  )

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && inputValue.trim()) {
      e.preventDefault()
      onAddTag(inputValue.trim())
      setInputValue('')
      setShowSuggestions(false)
    } else if (e.key === 'Escape') {
      setInputValue('')
      setShowSuggestions(false)
      inputRef.current?.blur()
    } else if (e.key === 'Backspace' && inputValue === '' && userTags.length > 0) {
      // Remove last tag when backspace is pressed on empty input
      const lastTag = userTags[userTags.length - 1]
      onRemoveTag(lastTag.id)
    }
  }

  const handleSuggestionClick = (tagName: string) => {
    onAddTag(tagName)
    setInputValue('')
    setShowSuggestions(false)
    inputRef.current?.focus()
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setInputValue(value)
    setShowSuggestions(value.length > 0 && suggestions.length > 0)
  }

  const handleInputFocus = () => {
    if (inputValue.length > 0 && suggestions.length > 0) {
      setShowSuggestions(true)
    }
  }

  const handleInputBlur = () => {
    // Delay hiding suggestions to allow clicking on them
    setTimeout(() => setShowSuggestions(false), 150)
  }

  const handleContainerClick = () => {
    inputRef.current?.focus()
  }

  return (
    <div className="relative">
      {/* Input Container with Tags */}
      <div 
        onClick={handleContainerClick}
        className="min-h-[36px] w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg focus-within:ring-2 focus-within:ring-[#FFB900] focus-within:border-transparent cursor-text flex flex-wrap gap-1 items-center"
      >
        {/* Existing Tags as Chips */}
        {userTags.map((tag) => (
          <span
            key={tag.id}
            className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-white/20 text-white border border-white/20"
          >
            <div 
              className="w-2 h-2 rounded-full mr-1"
              style={{ backgroundColor: tag.color }}
            />
            {tag.name}
            <button
              onClick={(e) => {
                e.stopPropagation()
                onRemoveTag(tag.id)
              }}
              className="ml-1 text-gray-400 hover:text-red-400 transition-colors"
            >
              <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </span>
        ))}

        {/* Input Field */}
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={handleInputFocus}
          onBlur={handleInputBlur}
          placeholder={userTags.length === 0 ? "Add tags..." : ""}
          className="flex-1 min-w-[60px] bg-transparent border-none outline-none text-sm text-white placeholder-gray-400"
        />
      </div>

      {/* Suggestions Dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute z-50 top-full left-0 mt-1 bg-[#1a1a1a] border border-white/10 rounded-lg shadow-lg min-w-full max-h-40 overflow-y-auto">
          {suggestions.map((tag) => (
            <button
              key={tag.id}
              onClick={() => handleSuggestionClick(tag.name)}
              className="w-full text-left px-3 py-2 hover:bg-white/5 flex items-center"
            >
              <div 
                className="w-3 h-3 rounded-full mr-2"
                style={{ backgroundColor: tag.color }}
              />
              <span className="text-sm text-white">{tag.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
} 