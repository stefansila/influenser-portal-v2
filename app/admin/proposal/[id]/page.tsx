'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '../../../context/AuthContext'
import { supabase } from '../../../lib/supabase'
import ConfirmationModal from '../../../components/ConfirmationModal'
import SystemMessages from '../../../components/SystemMessages'

type Proposal = {
  id: string
  title: string
  company_name: string
  campaign_start_date: string
  campaign_end_date: string
  short_description: string
  content: any
  created_at: string
}

type Response = {
  id: string
  user: {
    email: string
    full_name: string
  }
  status: 'accepted' | 'rejected'
  proposed_publish_date: string | null
  created_at: string
}

export default function ProposalDetailsPage() {
  const { id } = useParams()
  const router = useRouter()
  const { user } = useAuth()
  const [proposal, setProposal] = useState<Proposal | null>(null)
  const [responses, setResponses] = useState<Response[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [chatId, setChatId] = useState<string | null>(null)
  
  useEffect(() => {
    const fetchProposal = async () => {
      try {
        // Fetch the proposal
        const { data, error } = await supabase
          .from('proposals')
          .select('*')
          .eq('id', id)
          .single()
        
        if (error) {
          console.error('Error fetching proposal:', error)
          router.push('/admin')
          return
        }
        
        setProposal(data)
        
        // Fetch responses for this proposal with user info
        const { data: responseData, error: responseError } = await supabase
          .from('responses')
          .select(`
            id,
            status,
            proposed_publish_date,
            created_at,
            user:user_id (
              email,
              full_name
            )
          `)
          .eq('proposal_id', id)
          .order('created_at', { ascending: false })
        
        if (responseError) {
          console.error('Error fetching responses:', responseError)
        } else if (responseData) {
          // Transform the data to match the expected Response type
          const formattedResponses = responseData.map((item: any) => ({
            id: item.id,
            status: item.status,
            proposed_publish_date: item.proposed_publish_date,
            created_at: item.created_at,
            user: {
              email: item.user?.email || '',
              full_name: item.user?.full_name || ''
            }
          }))
          setResponses(formattedResponses)
        }
        
        // Fetch chat data
        const { data: chatData, error: chatError } = await supabase
          .from('chats')
          .select('id')
          .eq('proposal_id', id)
          .order('created_at', { ascending: false })
          .maybeSingle()
          
        if (chatError) {
          console.error('Error fetching chat:', chatError)
        } else {
          setChatId(chatData?.id || null)
        }
      } catch (err) {
        console.error('Error:', err)
        SystemMessages.system.operationFailed('Failed to load proposal')
      } finally {
        setIsLoading(false)
      }
    }
    
    fetchProposal()
  }, [id, router])
  
  // Format date range function
  const formatDateRange = (startDate: string, endDate: string) => {
    const start = new Date(startDate)
    const end = new Date(endDate)
    
    // Format the dates to display as "Month DD-DD" or "Month DD - Month DD" if different months
    const startMonth = start.toLocaleString('default', { month: 'long' })
    const endMonth = end.toLocaleString('default', { month: 'long' })
    
    if (startMonth === endMonth) {
      return `${startMonth} ${start.getDate()}-${end.getDate()}`
    } else {
      return `${startMonth} ${start.getDate()} - ${endMonth} ${end.getDate()}`
    }
  }
  
  // Format date function
  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A'
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }
  
  // Calculate timeline in days
  const calculateTimeline = (startDate: string, endDate: string) => {
    const start = new Date(startDate)
    const end = new Date(endDate)
    const diffTime = Math.abs(end.getTime() - start.getTime())
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return `${diffDays} days`
  }
  
  const handleDeleteProposal = async () => {
    if (!id) return
    
    setIsDeleting(true)
    
    try {
      console.log(`Starting deletion process for proposal: ${id}`)
      
      // First, find all response IDs related to this proposal
      const { data: responseIds, error: responsesError } = await supabase
        .from('responses')
        .select('id')
        .eq('proposal_id', id)
      
      if (responsesError) {
        console.error('Error fetching response IDs:', responsesError)
        throw responsesError
      }
      
      console.log(`Found ${responseIds?.length || 0} responses to delete`)
      
      // Extract IDs from the response data
      const responseIdList = responseIds?.map(r => r.id) || []
      
      // Step 1: Delete related admin_responses
      if (responseIdList.length > 0) {
        console.log(`Deleting admin responses for ${responseIdList.length} user responses`)
        const { error: adminResponsesError } = await supabase
          .from('admin_responses')
          .delete()
          .in('response_id', responseIdList)
        
        if (adminResponsesError) {
          console.error('Error deleting admin responses:', adminResponsesError)
          throw adminResponsesError
        }
        console.log('Admin responses deleted successfully')
      }
      
      // Step 2: Delete related notifications 
      console.log(`Deleting notifications related to proposal: ${id}`)
      const { error: notificationsError } = await supabase
        .from('notifications')
        .delete()
        .eq('related_proposal_id', id)
      
      if (notificationsError) {
        console.error('Error deleting notifications:', notificationsError)
        throw notificationsError
      }
      console.log('Proposal notifications deleted successfully')
      
      // Step 3: Delete any additional notifications related to responses
      if (responseIdList.length > 0) {
        console.log(`Deleting notifications related to ${responseIdList.length} responses`)
        const { error: responseNotificationsError } = await supabase
          .from('notifications')
          .delete()
          .in('related_response_id', responseIdList)
        
        if (responseNotificationsError) {
          console.error('Error deleting response notifications:', responseNotificationsError)
          throw responseNotificationsError
        }
        console.log('Response notifications deleted successfully')
      }
      
      // Step 4: Delete the responses
      if (responseIdList.length > 0) {
        console.log(`Deleting ${responseIdList.length} user responses`)
        const { error: deleteResponsesError } = await supabase
          .from('responses')
          .delete()
          .eq('proposal_id', id)
        
        if (deleteResponsesError) {
          console.error('Error deleting responses:', deleteResponsesError)
          throw deleteResponsesError
        }
        console.log('User responses deleted successfully')
      }
      
      // Step 5: Finally delete the proposal
      console.log(`Deleting the proposal with ID: ${id}`)
      const { data: deleteResult, error: deleteProposalError } = await supabase
        .from('proposals')
        .delete()
        .eq('id', id)
        .select()
      
      if (deleteProposalError) {
        console.error('Error deleting proposal:', deleteProposalError)
        throw deleteProposalError
      }
      
      console.log('Proposal deletion result:', deleteResult)
      console.log('Proposal deleted successfully')
      
      // Show success message
      SystemMessages.proposal.deleteSuccess()
      
      // Redirect to admin page
      router.push('/admin')
    } catch (error) {
      console.error('Error deleting proposal:', error)
      SystemMessages.system.operationFailed('Failed to delete proposal')
    } finally {
      setIsDeleting(false)
      setShowDeleteModal(false)
    }
  }
  
  if (isLoading || !proposal) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#080808]">
        <div className="w-8 h-8 border-t-2 border-[#FFB900] rounded-full animate-spin"></div>
      </div>
    )
  }
  
  return (
    <div className="p-10">
      <div className="mb-10 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link href="/admin" className="text-[#FFB900]">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M19 12H5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M12 19L5 12L12 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </Link>
          <h1 className="text-white text-3xl font-bold">{proposal.title}</h1>
        </div>
        
        <div className="flex items-center space-x-4">
          {chatId && (
            <Link 
              href={`/admin/chats/${chatId}?proposalId=${id}`}
              className="px-4 py-2 bg-[#1A1A1A] text-[#FFB900] rounded-full hover:bg-[#252525] transition-colors flex items-center space-x-2"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M21 11.5C21.0034 12.8199 20.6951 14.1219 20.1 15.3C19.3944 16.7118 18.3098 17.8992 16.9674 18.7293C15.6251 19.5594 14.0782 19.9994 12.5 20C11.1801 20.0035 9.87812 19.6951 8.7 19.1L3 21L4.9 15.3C4.30493 14.1219 3.99656 12.8199 4 11.5C4.00061 9.92176 4.44061 8.37488 5.27072 7.03258C6.10083 5.69028 7.28825 4.6056 8.7 3.90003C9.87812 3.30496 11.1801 2.99659 12.5 3.00003H13C15.0843 3.11502 17.053 3.99479 18.5291 5.47089C20.0052 6.94699 20.885 8.91568 21 11V11.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span>View Chat</span>
            </Link>
          )}
          <Link 
            href={`/admin/proposal/${id}/edit`}
            className="px-4 py-2 bg-[#FFB900] text-black rounded-full hover:bg-[#E6A800] transition-colors"
          >
            Edit Proposal
          </Link>
          <button
            onClick={() => setShowDeleteModal(true)}
            className="px-4 py-2 bg-red-600 text-white rounded-full hover:bg-red-700 transition-colors"
            disabled={isDeleting}
          >
            {isDeleting ? 'Deleting...' : 'Delete Proposal'}
          </button>
        </div>
      </div>
      
      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={showDeleteModal}
        title="Delete Proposal"
        message={`Are you sure you want to delete "${proposal.title}"? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={handleDeleteProposal}
        onCancel={() => setShowDeleteModal(false)}
        isDestructive={true}
      />
      
      <div className="grid grid-cols-3 gap-8 mb-12">
        <div className="bg-[#121212] border border-white/5 p-6">
          <h3 className="text-[#FFB900] text-sm mb-1">Company</h3>
          <p className="text-white">{proposal.company_name}</p>
        </div>
        <div className="bg-[#121212] border border-white/5 p-6">
          <h3 className="text-[#FFB900] text-sm mb-1">Campaign Date</h3>
          <p className="text-white">
            {formatDateRange(
              proposal.campaign_start_date,
              proposal.campaign_end_date
            )}
          </p>
        </div>
        <div className="bg-[#121212] border border-white/5 p-6">
          <h3 className="text-[#FFB900] text-sm mb-1">Timeline</h3>
          <p className="text-white">
            {calculateTimeline(
              proposal.campaign_start_date,
              proposal.campaign_end_date
            )}
          </p>
        </div>
      </div>
      
      <div className="mb-12">
        <h2 className="text-white text-2xl font-bold mb-4">Description</h2>
        <div className="bg-[#121212] border border-white/5 p-6">
          <p className="text-white">{proposal.short_description}</p>
        </div>
      </div>
      
      <div className="mb-12">
        <h2 className="text-white text-2xl font-bold mb-4">Full Content</h2>
        <div className="bg-[#121212] border border-white/5 p-6">
          {proposal.content?.blocks?.map((block: any, index: number) => (
            <div key={index} className="mb-4">
              {block.type === 'paragraph' && (
                <p className="text-white">{block.text}</p>
              )}
              {block.type === 'heading' && (
                <h3 className="text-white text-xl font-bold mb-2">{block.text}</h3>
              )}
              {block.type === 'list' && (
                <ul className="list-disc list-inside text-white">
                  {block.items.map((item: string, itemIndex: number) => (
                    <li key={itemIndex}>{item}</li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      </div>
      
      <div className="mb-12">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-white text-2xl font-bold">Responses</h2>
          <Link 
            href={`/admin/proposal/${id}/responses`} 
            className="text-[#FFB900]"
          >
            View All Responses
          </Link>
        </div>
        
        {responses.length === 0 ? (
          <div className="bg-[#121212] border border-white/5 p-6 rounded-lg text-center">
            <p className="text-gray-400">No responses yet.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {responses.slice(0, 3).map((response) => (
              <div key={response.id} className={`bg-[#121212] border ${
                response.status === 'accepted' ? 'border-[#1e3a1e]' : 'border-[#3a1e1e]'
              } p-6`}>
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-white text-lg font-medium mb-2">
                      {response.user.full_name || response.user.email}
                    </h3>
                    
                    <div className="flex space-x-12 mb-4">
                      <div>
                        <p className="text-sm text-[#FFB900]">Submitted On</p>
                        <p className="text-gray-300">{formatDate(response.created_at)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-[#FFB900]">Proposed Publish Date</p>
                        <p className="text-gray-300">{formatDate(response.proposed_publish_date)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-[#FFB900]">Status</p>
                        <p className={`capitalize ${
                          response.status === 'accepted' ? 'text-green-500' : 'text-red-500'
                        }`}>
                          {response.status}
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  <Link
                    href={`/admin/response/${response.id}`}
                    className="flex items-center space-x-2 text-[#FFB900]"
                  >
                    <span>View Response</span>
                    <svg width="7" height="14" viewBox="0 0 7 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M1 1L6 7L1 13" stroke="#FFB900" strokeWidth="1.67" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}