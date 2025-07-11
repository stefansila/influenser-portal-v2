'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import Link from 'next/link'
import Image from 'next/image'
import { v4 as uuidv4 } from 'uuid'
import ESignature from '../../components/ESignature'
import { uploadSignature } from '../../utils/signatureUpload'

const platforms = [
  { id: 'youtube', name: 'YouTube', icon: '📺' },
  { id: 'instagram', name: 'Instagram', icon: '📸' },
  { id: 'tiktok', name: 'TikTok', icon: '🎵' },
  { id: 'facebook', name: 'Facebook', icon: '👥' },
  { id: 'x', name: 'X / Twitter', icon: '🐦' }
]

const paymentMethods = [
  { id: 'paypal', name: 'PayPal' },
  { id: 'wire', name: 'Wire Transfer' },
  { id: 'crypto', name: 'Cryptocurrency' }
]

export default function ApplyOfferPage() {
  const { user, isLoading } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const proposalId = searchParams.get('proposalId')
  
  const [proposal, setProposal] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  
  // Form state
  const [quote, setQuote] = useState('')
  const [publishDate, setPublishDate] = useState('')
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([])
  const [paymentMethod, setPaymentMethod] = useState('')
  const [message, setMessage] = useState('')
  const [disclaimerAccepted, setDisclaimerAccepted] = useState(false)
  const [signatureDataURL, setSignatureDataURL] = useState<string | null>(null)
  
  // Validation state
  const [errors, setErrors] = useState<{[key: string]: string}>({})
  const [dateWarning, setDateWarning] = useState<string>('')

  useEffect(() => {
    const fetchProposalDetails = async () => {
      if (!user) {
        router.push('/login')
        return
      }

      if (!proposalId) {
        router.push('/dashboard')
        return
      }

      try {
        // Fetch proposal details
        const { data, error } = await supabase
          .from('proposals')
          .select('*')
          .eq('id', proposalId)
          .single()
        
        if (error) {
          console.error('Error fetching proposal:', error)
          router.push('/dashboard')
          return
        }
        
        setProposal(data)
      } catch (error) {
        console.error('Error:', error)
      } finally {
        setLoading(false)
      }
    }

    if (!isLoading) {
      fetchProposalDetails()
    }
  }, [user, isLoading, router, proposalId])

  const handlePlatformChange = (platformId: string) => {
    setSelectedPlatforms(prev => {
      if (prev.includes(platformId)) {
        return prev.filter(id => id !== platformId)
      } else {
        return [...prev, platformId]
      }
    })
  }

  // Handle date change with real-time validation for mobile devices
  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedDate = e.target.value
    setPublishDate(selectedDate)
    
    // Clear any existing date warning
    setDateWarning('')
    
    // Validate date range immediately for mobile devices
    if (selectedDate && proposal) {
      const publishDateObj = new Date(selectedDate)
      const campaignStartObj = new Date(proposal.campaign_start_date)
      const campaignEndObj = new Date(proposal.campaign_end_date)
      
      if (publishDateObj < campaignStartObj || publishDateObj > campaignEndObj) {
        setDateWarning(`Selected date is outside campaign period. Please choose a date between ${campaignStartObj.toLocaleDateString()} and ${campaignEndObj.toLocaleDateString()}`)
      }
    }
  }

  const validateForm = () => {
    const newErrors: {[key: string]: string} = {}
    
    if (!quote) newErrors.quote = 'Please enter a project quote'
    if (!publishDate) {
      newErrors.publishDate = 'Please select a publish date'
    } else {
      // Check if publish date is within campaign date range
      const publishDateObj = new Date(publishDate)
      const campaignStartObj = new Date(proposal.campaign_start_date)
      const campaignEndObj = new Date(proposal.campaign_end_date)
      
      if (publishDateObj < campaignStartObj || publishDateObj > campaignEndObj) {
        newErrors.publishDate = `Publish date must be between ${campaignStartObj.toLocaleDateString()} and ${campaignEndObj.toLocaleDateString()}`
      }
    }
    if (selectedPlatforms.length === 0) newErrors.platforms = 'Please select at least one platform'
    if (!paymentMethod) newErrors.paymentMethod = 'Please select a payment method'
    if (proposal.disclaimer && !disclaimerAccepted) newErrors.disclaimer = 'You must accept the disclaimer to proceed'
    if (!signatureDataURL) newErrors.signature = 'Digital signature is required'
    
    // Also check for active date warning (for mobile devices)
    if (dateWarning) {
      newErrors.publishDate = dateWarning
    }
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) return
    
    setSubmitting(true)
    
    try {
      // Upload signature first
      let signatureUrl = null
      if (signatureDataURL) {
        signatureUrl = await uploadSignature(signatureDataURL, user!.id, proposalId!)
        if (!signatureUrl) {
          throw new Error('Failed to upload signature')
        }
      }

      // Create response in database (without message field)
      const responseData = {
        proposal_id: proposalId,
        user_id: user!.id,
        status: 'accepted',
        progress_status: 'accepted',
        quote: quote,
        proposed_publish_date: publishDate,
        platforms: selectedPlatforms,
        payment_method: paymentMethod,
        disclaimer_accepted: disclaimerAccepted,
        signature_url: signatureUrl
      }
      
      const { data: newResponse, error } = await supabase
        .from('responses')
        .insert(responseData)
        .select('id')
        .single()
        
      if (error) throw error
      
      // If user provided a message, create a chat message
      if (message.trim()) {
        // Find the chat that was created by the trigger
        const { data: chatData, error: chatError } = await supabase
          .from('chats')
          .select('id')
          .eq('proposal_id', proposalId)
          .eq('user_id', user!.id)
          .single()
        
        if (chatError) {
          console.error('Error finding chat:', chatError)
        } else if (chatData) {
          // Create the chat message
          const { error: messageError } = await supabase
            .from('chat_messages')
            .insert({
              chat_id: chatData.id,
              user_id: user!.id,
              message: message.trim()
            })
          
          if (messageError) {
            console.error('Error creating chat message:', messageError)
          }
        }
      }
      
      // Redirect to dashboard with success message
      router.push('/dashboard?success=true')
      
    } catch (error: any) {
      console.error('Error submitting response:', error.message)
      alert('Failed to submit your response. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (isLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="w-8 h-8 border-t-2 border-white rounded-full animate-spin"></div>
      </div>
    )
  }

  if (!proposal) {
    return (
      <div className="p-8 min-h-screen bg-background">
        <div className="flex flex-col items-center justify-center p-12 bg-[#121212] border border-white/5 text-center rounded-md">
          <p className="text-xl text-gray-300 mb-3">Proposal not found</p>
          <p className="text-gray-400">The proposal you are looking for doesn't exist</p>
          <Link
            href="/dashboard"
            className="mt-8 inline-flex items-center justify-between px-8 py-4 bg-white rounded-full"
          >
            <span className="mr-4 text-black font-medium">Back to Dashboard</span>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8 min-h-screen bg-background">
      {/* Back button */}
      <div className="mb-8">
        <Link
          href={`/dashboard/proposal/${proposalId}`}
          className="text-[#FFB900] flex items-center space-x-2"
        >
          <svg width="7" height="14" viewBox="0 0 7 14" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M6 1L1 7L6 13" stroke="#FFB900" strokeWidth="1.67" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span>Back to Proposal</span>
        </Link>
      </div>

      {/* Page title */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white">Apply to Offer</h1>
        <p className="text-gray-400 mt-2">Complete the form below to apply for the "{proposal.title}" opportunity</p>
      </div>

      {/* Application form */}
      <div className="bg-[#121212] border border-white/5 p-8">
        <form onSubmit={handleSubmit} className="space-y-8 apply-offer-box">
          {/* Quote */}
          <div className="space-y-2">
            <label htmlFor="quote" className="block text-sm text-[#FFB900]">
              Project Quote
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">$</span>
              <input
                type="text"
                id="quote"
                value={quote}
                onChange={(e) => {
                  // Allow only numbers and decimal point
                  const value = e.target.value.replace(/[^0-9.]/g, '')
                  setQuote(value)
                }}
                className="bg-[#080808] border border-white/10 rounded-lg py-3 px-10 w-full text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-[#FFB900] focus:border-[#FFB900]"
                placeholder="Enter amount"
              />
            </div>
            {errors.quote && <p className="text-red-500 text-sm">{errors.quote}</p>}
          </div>

          {/* Publish Date */}
          <div className="space-y-2">
            <label htmlFor="publishDate" className="block text-sm text-[#FFB900]">
              Proposed Publish Date
            </label>
            <input
              type="date"
              id="publishDate"
              value={publishDate}
              onChange={handleDateChange}
              min={proposal.campaign_start_date}
              max={proposal.campaign_end_date}
              className={`date-input-field focus:ring-1 focus:ring-[#FFB900] focus:border-[#FFB900] ${dateWarning ? 'date-invalid' : ''}`}
            />
            <p className="text-xs text-gray-400">
              Must be between {new Date(proposal.campaign_start_date).toLocaleDateString()} and {new Date(proposal.campaign_end_date).toLocaleDateString()}
            </p>
            {errors.publishDate && <p className="text-red-500 text-sm">{errors.publishDate}</p>}
            {dateWarning && <p className="text-red-500 text-sm">{dateWarning}</p>}
          </div>

          {/* Platforms */}
          <div className="space-y-2">
            <p className="block text-sm text-[#FFB900]">Platforms</p>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {platforms.map((platform) => (
                <label 
                  key={platform.id} 
                  className={`flex flex-col items-center justify-center p-4 border rounded-xl cursor-pointer transition-colors ${
                    selectedPlatforms.includes(platform.id) 
                      ? 'bg-[#FFB900]/10 border-[#FFB900] text-white' 
                      : 'bg-[#080808] border-white/10 text-gray-400 hover:bg-white/5'
                  }`}
                >
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={selectedPlatforms.includes(platform.id)}
                    onChange={() => handlePlatformChange(platform.id)}
                  />
                  <span className="text-2xl mb-2">{platform.icon}</span>
                  <span className="text-sm">{platform.name}</span>
                </label>
              ))}
            </div>
            {errors.platforms && <p className="text-red-500 text-sm">{errors.platforms}</p>}
          </div>

          {/* Payment Method */}
          <div className="space-y-2">
            <label htmlFor="paymentMethod" className="block text-sm text-[#FFB900]">
              Payment Method
            </label>
            <select
              id="paymentMethod"
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="select-field focus:ring-1 focus:ring-[#FFB900] focus:border-[#FFB900]"
            >
              <option value="">Select payment method</option>
              {paymentMethods.map((method) => (
                <option key={method.id} value={method.id}>
                  {method.name}
                </option>
              ))}
            </select>
            {errors.paymentMethod && <p className="text-red-500 text-sm">{errors.paymentMethod}</p>}
          </div>

          {/* Message */}
          <div className="space-y-2">
            <label htmlFor="message" className="block text-sm text-[#FFB900]">
              Message (Optional)
            </label>
            <textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              placeholder="Add any additional information or questions..."
              className="bg-[#080808] border border-white/10 rounded-lg py-3 px-4 w-full text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-[#FFB900] focus:border-[#FFB900]"
            ></textarea>
          </div>

          {/* Disclaimer */}
          {proposal.disclaimer && (
            <div className="space-y-4">
              <div className="p-4 bg-[#080808] border border-white/10 rounded-lg">
                <h3 className="text-[#FFB900] font-medium mb-2">Legal Disclaimer</h3>
                <p className="text-white text-sm whitespace-pre-line">{proposal.disclaimer}</p>
              </div>
              
              <div className="flex items-start space-x-3">
                <input
                  type="checkbox"
                  id="disclaimerAccepted"
                  checked={disclaimerAccepted}
                  onChange={(e) => setDisclaimerAccepted(e.target.checked)}
                  className="mt-1 w-4 h-4 text-[#FFB900] bg-[#080808] border border-white/20 rounded focus:ring-[#FFB900] focus:ring-2"
                />
                <label htmlFor="disclaimerAccepted" className="text-white text-sm cursor-pointer">
                  I have read and agree to the terms in the disclaimer
                </label>
              </div>
              {errors.disclaimer && <p className="text-red-500 text-sm">{errors.disclaimer}</p>}
            </div>
          )}

          {/* Signature */}
          <div className="space-y-2">
            <ESignature onSignatureChange={setSignatureDataURL} />
            {errors.signature && <p className="text-red-500 text-sm">{errors.signature}</p>}
          </div>

          {/* Submit Button */}
          <div>
            <button
              type="submit"
              disabled={submitting}
              className="w-full flex items-center justify-center space-x-2 px-8 py-4 bg-[#FFB900] rounded-full hover:bg-[#E6A800] transition-colors text-black font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Submitting...' : 'Submit Application'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
} 