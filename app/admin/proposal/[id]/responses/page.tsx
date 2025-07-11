'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '../../../../context/AuthContext'
import { supabase } from '../../../../lib/supabase'
import ConfirmationModal from '../../../../components/ConfirmationModal'
import SystemMessages from '../../../../components/SystemMessages'

type UserResponse = {
  id: string
  status: 'accepted' | 'rejected'
  proposed_publish_date: string | null
  platforms: string[]
  quote: string
  payment_method: string
  created_at: string
  progress_status?: 'no_response' | 'accepted' | 'live' | 'completed'
  user: {
    id: string
    email: string
    full_name: string | null
    avatar_url: string | null
  }
  admin_response?: {
    status: 'pending' | 'approved' | 'rejected' | 'completed'
  } | null
}

type Proposal = {
  id: string
  title: string
  company_name: string
}

export default function AllResponsesPage() {
  const { id } = useParams()
  const router = useRouter()
  const { user } = useAuth()
  const [proposal, setProposal] = useState<Proposal | null>(null)
  const [responses, setResponses] = useState<UserResponse[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [sortField, setSortField] = useState<string>('created_at')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  
  useEffect(() => {
    const fetchData = async () => {
      try {
        // 1. Fetch the proposal details
        const { data: proposalData, error: proposalError } = await supabase
          .from('proposals')
          .select('id, title, company_name')
          .eq('id', id)
          .single()
        
        if (proposalError) {
          console.error('Error fetching proposal:', proposalError)
          router.push('/admin')
          return
        }
        
        setProposal(proposalData)
        
        // 2. Fetch responses with user_id
        const { data: responseData, error: responseError } = await supabase
          .from('responses')
          .select('id, status, proposed_publish_date, platforms, quote, payment_method, created_at, user_id, progress_status')
          .eq('proposal_id', id)
          .order(sortField, { ascending: sortOrder === 'asc' })
        
        if (responseError || !responseData) {
          console.error('Error fetching responses:', responseError)
          setIsLoading(false)
          return
        }
        
        // 3. Get a unique list of user IDs
        const userIds = Array.from(new Set(responseData.map(r => r.user_id)))
        
        // 4. Fetch all users in a single query
        const { data: usersData, error: usersError } = await supabase
          .from('users')
          .select('id, email, full_name, avatar_url')
          .in('id', userIds)
        
        if (usersError) {
          console.error('Error fetching users:', usersError)
        }
        
        // 5. Create a map of users by ID
        const usersMap = new Map()
        usersData?.forEach(user => {
          usersMap.set(user.id, user)
        })
        
        // 6. Fetch admin responses
        const { data: adminResponses, error: adminResponsesError } = await supabase
          .from('admin_responses')
          .select('id, response_id, status')
        
        if (adminResponsesError) {
          console.error('Error fetching admin responses:', adminResponsesError)
        }
        
        // 7. Create a map of admin responses by response_id
        const adminResponsesMap = new Map()
        adminResponses?.forEach(ar => {
          adminResponsesMap.set(ar.response_id, ar)
        })
        
        // 8. Combine all the data
        const formattedResponses = responseData.map(item => {
          const userData = usersMap.get(item.user_id) || { id: item.user_id, email: 'Unknown', full_name: null, avatar_url: null }
          const adminResponse = adminResponsesMap.get(item.id)
          
          return {
            id: item.id,
            status: item.status,
            proposed_publish_date: item.proposed_publish_date,
            platforms: item.platforms || [],
            quote: item.quote || '',
            payment_method: item.payment_method || '',
            created_at: item.created_at,
            progress_status: item.progress_status,
            user: {
              id: userData.id,
              email: userData.email,
              full_name: userData.full_name,
              avatar_url: userData.avatar_url
            },
            admin_response: adminResponse ? {
              status: adminResponse.status
            } : null
          } as UserResponse
        })
        
        // 9. Sort by user name if needed
        if (sortField === 'user.full_name') {
          formattedResponses.sort((a, b) => {
            const nameA = (a.user.full_name || a.user.email || '').toLowerCase()
            const nameB = (b.user.full_name || b.user.email || '').toLowerCase()
            return sortOrder === 'asc' 
              ? nameA.localeCompare(nameB)
              : nameB.localeCompare(nameA)
          })
        }
        // Sort by admin status if needed
        else if (sortField === 'admin_status') {
          formattedResponses.sort((a, b) => {
            // Use progress_status if completed, otherwise use admin_response status
            const statusA = a.progress_status === 'completed' ? 'completed' : (a.admin_response?.status || 'pending')
            const statusB = b.progress_status === 'completed' ? 'completed' : (b.admin_response?.status || 'pending')
            // Custom status order: completed, approved, pending, rejected
            const statusOrder = { 
              completed: 1,
              approved: 2, 
              pending: 3, 
              rejected: 4 
            }
            const orderA = statusOrder[statusA as keyof typeof statusOrder]
            const orderB = statusOrder[statusB as keyof typeof statusOrder]
            
            return sortOrder === 'asc' 
              ? orderA - orderB
              : orderB - orderA
          })
        }
        
        setResponses(formattedResponses)
      } catch (error) {
        console.error('Error fetching data:', error)
      } finally {
        setIsLoading(false)
      }
    }
    
    if (id) {
      fetchData()
    }
  }, [id, router, sortField, sortOrder])
  
  const handleSort = (field: string) => {
    if (field === sortField) {
      // Toggle sort order if clicking the same field
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      // Default to descending for a new field
      setSortField(field)
      setSortOrder('desc')
    }
  }
  
  // Format date function
  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A'
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
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
  
  // Separate responses by status
  const acceptedResponses = responses.filter(r => r.status === 'accepted')
  const rejectedResponses = responses.filter(r => r.status === 'rejected')
  
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
          <div>
            <h1 className="text-white text-3xl font-bold">{proposal.title}</h1>
            <p className="text-gray-400">{proposal.company_name}</p>
          </div>
        </div>
        
        <div className="flex items-center space-x-3">
          <Link 
            href={`/admin/proposal/${id}/edit`} 
            className="px-4 py-2 bg-white rounded-md text-black flex items-center space-x-2"
          >
            <span className="font-medium">Edit Proposal</span>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M11.3332 2.00004C11.5084 1.82494 11.7157 1.68605 11.9451 1.59129C12.1745 1.49653 12.4213 1.44775 12.6707 1.44775C12.92 1.44775 13.1668 1.49653 13.3962 1.59129C13.6256 1.68605 13.8329 1.82494 14.0082 2.00004C14.1833 2.17513 14.3222 2.38246 14.4169 2.61187C14.5117 2.84128 14.5605 3.08809 14.5605 3.33737C14.5605 3.58666 14.5117 3.83346 14.4169 4.06288C14.3222 4.29229 14.1833 4.49962 14.0082 4.67471L4.83317 13.8497L1.33317 14.6667L2.14984 11.1667L11.3332 2.00004Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </Link>
          <button
            onClick={() => setShowDeleteModal(true)}
            className="px-4 py-2 bg-red-600 text-white rounded-md flex items-center space-x-2 hover:bg-red-700 transition-colors"
            disabled={isDeleting}
          >
            <span className="font-medium">{isDeleting ? 'Deleting...' : 'Delete Proposal'}</span>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M2 4H3.33333H14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M5.33334 4V2.66667C5.33334 2.31305 5.47382 1.97391 5.72387 1.72386C5.97392 1.47381 6.31305 1.33334 6.66668 1.33334H9.33334C9.68697 1.33334 10.0261 1.47381 10.2761 1.72386C10.5262 1.97391 10.6667 2.31305 10.6667 2.66667V4M12.6667 4V13.3333C12.6667 13.687 12.5262 14.0261 12.2761 14.2761C12.0261 14.5262 11.687 14.6667 11.3333 14.6667H4.66668C4.31305 14.6667 3.97392 14.5262 3.72387 14.2761C3.47382 14.0261 3.33334 13.687 3.33334 13.3333V4H12.6667Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      </div>
      
      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={showDeleteModal}
        title="Delete Proposal"
        message={`Are you sure you want to delete "${proposal?.title}"? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={handleDeleteProposal}
        onCancel={() => setShowDeleteModal(false)}
        isDestructive={true}
      />
      
      <div className="mb-8 flex justify-between items-center">
        <h2 className="text-white text-2xl font-bold">All Responses ({responses.length})</h2>
        
        <div className="flex items-center space-x-4">
          <span className="text-white">Sort By:</span>
          <button 
            onClick={() => handleSort('created_at')}
            className={`px-3 py-1 rounded ${sortField === 'created_at' ? 'bg-[#FFB900] text-black' : 'bg-[#222] text-white'}`}
          >
            Date {sortField === 'created_at' && (sortOrder === 'asc' ? '↑' : '↓')}
          </button>
          <button 
            onClick={() => handleSort('status')}
            className={`px-3 py-1 rounded ${sortField === 'status' ? 'bg-[#FFB900] text-black' : 'bg-[#222] text-white'}`}
          >
            Status {sortField === 'status' && (sortOrder === 'asc' ? '↑' : '↓')}
          </button>
          <button 
            onClick={() => handleSort('user.full_name')}
            className={`px-3 py-1 rounded ${sortField === 'user.full_name' ? 'bg-[#FFB900] text-black' : 'bg-[#222] text-white'}`}
          >
            Name {sortField === 'user.full_name' && (sortOrder === 'asc' ? '↑' : '↓')}
          </button>
          <button 
            onClick={() => handleSort('admin_status')}
            className={`px-3 py-1 rounded ${sortField === 'admin_status' ? 'bg-[#FFB900] text-black' : 'bg-[#222] text-white'}`}
          >
            Admin Status {sortField === 'admin_status' && (sortOrder === 'asc' ? '↑' : '↓')}
          </button>
        </div>
      </div>
      
      {responses.length === 0 ? (
        <div className="bg-[#121212] border border-white/5 p-6 text-center">
          <p className="text-gray-400">No responses yet</p>
        </div>
      ) : (
        <div className="responsive-table-container">
          <div className="min-w-[800px] space-y-4">
            {/* Table headers */}
            <div className="grid grid-cols-6 gap-4 text-[#FFB900] text-sm px-4 py-2">
              <div className="min-w-0">
                <div className="table-column-overflow">Email</div>
              </div>
              <div className="min-w-0">
                <div className="table-column-overflow">Date</div>
              </div>
              <div className="min-w-0">
                <div className="table-column-overflow">Quote</div>
              </div>
              <div className="min-w-0">
                <div className="table-column-overflow">Platforms</div>
              </div>
              <div className="min-w-0">
                <div className="table-column-overflow">Admin Status</div>
              </div>
              <div className="min-w-0 text-right">
                <div className="table-column-overflow">Details</div>
              </div>
            </div>
            
            {/* Table rows */}
            {responses.map((response) => (
              <div 
                key={response.id} 
                className={`bg-[#121212] border ${
                  response.status === 'accepted' ? 'border-[#1e3a1e]' : 'border-[#3a1e1e]'
                } p-6 grid grid-cols-6 gap-4 items-center`}
              >
                <div className="min-w-0">
                  <div className="table-column-overflow">
                    <p className="text-white whitespace-nowrap">{response.user.email}</p>
                  </div>
                </div>
                
                <div className="min-w-0">
                  <div className="table-column-overflow">
                    <p className="text-white whitespace-nowrap">{formatDate(response.created_at)}</p>
                  </div>
                </div>
                
                <div className="min-w-0">
                  <div className="table-column-overflow">
                    <p className="text-white whitespace-nowrap">{response.quote || 'No quote provided'}</p>
                  </div>
                </div>
                
                <div className="min-w-0">
                  <div className="table-column-overflow">
                    <p className="text-white whitespace-nowrap">{response.platforms?.join(', ') || 'None'}</p>
                  </div>
                </div>
                
                <div className="min-w-0">
                  <div className="table-column-overflow">
                    <p className={`capitalize font-medium whitespace-nowrap ${
                      response.admin_response?.status === 'completed' ? 'text-purple-500' :
                      response.admin_response?.status === 'approved' ? 'text-green-500' : 
                      response.admin_response?.status === 'rejected' ? 'text-red-500' : 
                      'text-gray-400'
                    }`}>
                      {response.admin_response?.status === 'completed' ? 'Completed' : (response.admin_response?.status || 'Pending')}
                    </p>
                  </div>
                </div>
                
                <div className="min-w-0 text-right">
                  <div className="table-column-overflow">
                    <Link 
                      href={`/admin/response/${response.id}`}
                      className="text-[#FFB900] inline-flex items-center space-x-2 whitespace-nowrap"
                    >
                      <span>Details</span>
                      <svg width="7" height="14" viewBox="0 0 7 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M1 1L6 7L1 13" stroke="#FFB900" strokeWidth="1.67" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
} 