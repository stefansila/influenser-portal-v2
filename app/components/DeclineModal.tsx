'use client'

import { useState } from 'react'

interface DeclineModalProps {
  isOpen: boolean
  title: string
  onConfirm: (reason: string) => void
  onCancel: () => void
  proposalTitle: string
}

export default function DeclineModal({
  isOpen,
  title,
  onConfirm,
  onCancel,
  proposalTitle
}: DeclineModalProps) {
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = () => {
    if (!reason.trim()) {
      setError('Please provide a reason for declining')
      return
    }
    
    onConfirm(reason)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
      <div className="bg-[#121212] border border-white/10 rounded-lg w-full max-w-md overflow-hidden">
        <div className="p-6">
          <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
          <p className="text-gray-300 mb-4">Are you sure you want to decline "{proposalTitle}"?</p>
          
          <div className="mb-6">
            <label htmlFor="decline-reason" className="block text-sm text-[#FFB900] mb-2">
              Please provide a reason
            </label>
            <textarea
              id="decline-reason"
              value={reason}
              onChange={(e) => {
                setReason(e.target.value)
                setError('')
              }}
              rows={4}
              placeholder="Why are you declining this offer?"
              className="bg-[#080808] border border-white/10 rounded-lg py-3 px-4 w-full text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-[#FFB900] focus:border-[#FFB900]"
            ></textarea>
            {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
          </div>
          
          <div className="flex space-x-4">
            <button
              onClick={onCancel}
              className="flex-1 px-4 py-3 border border-white/10 text-white rounded-full hover:bg-white/5 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded-full transition-colors"
            >
              Decline Offer
            </button>
          </div>
        </div>
      </div>
    </div>
  )
} 