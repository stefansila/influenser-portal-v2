'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '../../../context/AuthContext'
import { supabase } from '../../../lib/supabase'

type UserResponse = {
  id: string
  user: {
    id: string
    full_name: string | null
    email: string
  }
  status: 'accepted' | 'rejected'
  quote: string
  proposed_publish_date: string | null
  platforms: string[]
  created_at: string
}

export default function CompanyProposalsPage() {
  const { id } = useParams()
  const router = useRouter()
  const { user } = useAuth()
  const [company, setCompany] = useState<string>('')
  const [responses, setResponses] = useState<UserResponse[]>([])
  const [sortBy, setSortBy] = useState<string>('created_at')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [isLoading, setIsLoading] = useState(true)
  
  useEffect(() => {
    const fetchResponses = async () => {
      try {
        // Fetch the company name from the first proposal
        const { data: proposalData, error: proposalError } = await supabase
          .from('proposals')
          .select('company_name')
          .eq('id', id)
          .single()
        
        if (proposalError) {
          console.error('Error fetching company:', proposalError)
          router.push('/admin')
          return
        }
        
        setCompany(proposalData.company_name)
        
        // Now get all proposals for this company
        const { data: companyProposals, error: companyError } = await supabase
          .from('proposals')
          .select('id')
          .eq('company_name', proposalData.company_name)
        
        if (companyError) {
          console.error('Error fetching company proposals:', companyError)
          return
        }
        
        // Get all proposal ids
        const proposalIds = companyProposals.map(p => p.id)
        
        // Fetch all responses for these proposals
        const { data: responseData, error: responseError } = await supabase
          .from('responses')
          .select(`
            id,
            status,
            quote,
            proposed_publish_date,
            platforms,
            created_at,
            user:user_id (
              id,
              email,
              full_name
            )
          `)
          .in('proposal_id', proposalIds)
          .order(sortBy, { ascending: sortOrder === 'asc' })
        
        if (responseError) {
          console.error('Error fetching responses:', responseError)
        } else {
          // Transform the response data to match expected type
          const formattedResponses = responseData.map((item: any) => ({
            id: item.id,
            user: item.user,
            status: item.status,
            quote: item.quote || '',
            proposed_publish_date: item.proposed_publish_date,
            platforms: item.platforms || [],
            created_at: item.created_at
          }))
          
          setResponses(formattedResponses)
        }
      } catch (error) {
        console.error('Error fetching data:', error)
      } finally {
        setIsLoading(false)
      }
    }
    
    if (id) {
      fetchResponses()
    }
  }, [id, router, sortBy, sortOrder])
  
  const handleSortChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSortBy(e.target.value)
  }
  
  const toggleSortOrder = () => {
    setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
  }
  
  // Format date function
  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }
  
  if (isLoading) {
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
          <h1 className="text-white text-3xl font-bold">{company}</h1>
        </div>
        
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <span className="text-white">Sort By:</span>
            <select 
              value={sortBy}
              onChange={handleSortChange}
              className="select-field bg-[#222] text-white border-[#333]"
            >
              <option value="created_at">Date</option>
              <option value="status">Status</option>
            </select>
          </div>
          
          <button 
            onClick={toggleSortOrder}
            className="bg-[#222] text-white px-3 py-2 rounded border border-[#333] flex items-center space-x-1"
          >
            <span>{sortOrder === 'asc' ? 'Ascending' : 'Descending'}</span>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d={sortOrder === 'asc' 
                ? "M2 10L6 6L10 10" 
                : "M2 2L6 6L10 2"} 
                stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      </div>
      
      {responses.length === 0 ? (
        <div className="bg-[#121212] border border-white/5 p-6 text-center">
          <p className="text-white">No responses found</p>
        </div>
      ) : (
        <div className="responsive-table-container">
          <div className="min-w-[700px] space-y-4">
            {/* Table headers */}
            <div className="grid grid-cols-5 gap-4 text-[#FFB900] text-sm px-4 py-2">
              <div className="min-w-0">
                <div className="table-column-overflow">By</div>
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
                } p-6 grid grid-cols-5 gap-4 items-center`}
              >
                <div className="min-w-0">
                  <div className="table-column-overflow">
                    <p className="text-white whitespace-nowrap">{response.user.full_name || response.user.email}</p>
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