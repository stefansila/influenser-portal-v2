'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'

type CompanySummary = {
  id: string
  company_name: string
  proposal_count: number
  response_count: number
}

export default function OldProposalsPage() {
  const { user, isLoading } = useAuth()
  const [companies, setCompanies] = useState<CompanySummary[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const checkAdminStatus = async () => {
      if (!user) return
      
      // Check if user is an admin
      const { data, error } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single()
      
      if (error || data?.role !== 'admin') {
        // Not an admin, redirect to user dashboard
        router.push('/dashboard')
      }
    }
    
    const fetchExpiredProposals = async () => {
      try {
        // Get current date
        const currentDate = new Date().toISOString().split('T')[0]
        
        // Fetch expired proposals (end date < current date)
        const { data, error } = await supabase
          .from('proposals')
          .select('id, company_name')
          .lt('campaign_end_date', currentDate)
          .order('campaign_end_date', { ascending: false })
        
        if (error) throw error
        
        // Process data to count proposals per company
        const companyMap = new Map<string, { count: number, id: string, proposals: string[] }>()
        
        data.forEach(proposal => {
          if (!companyMap.has(proposal.company_name)) {
            companyMap.set(proposal.company_name, { 
              count: 1, 
              id: proposal.id,
              proposals: [proposal.id]
            })
          } else {
            const current = companyMap.get(proposal.company_name)!
            current.count += 1
            current.proposals.push(proposal.id)
          }
        })
        
        // Fetch all response counts for each proposal
        const companyList = []
        
        for (const [company_name, info] of Array.from(companyMap.entries())) {
          // Fetch responses for all proposals from this company
          const { data: responseData, error: responseError } = await supabase
            .from('responses')
            .select('id, proposal_id')
            .in('proposal_id', info.proposals)
          
          if (responseError) {
            console.error('Error fetching responses:', responseError)
          }
          
          const responseCount = responseData ? responseData.length : 0
          
          companyList.push({
            id: info.id,
            company_name,
            proposal_count: info.count,
            response_count: responseCount
          })
        }
        
        setCompanies(companyList)
      } catch (error) {
        console.error('Error fetching expired proposals:', error)
      } finally {
        setLoading(false)
      }
    }
    
    if (user && !isLoading) {
      checkAdminStatus()
      fetchExpiredProposals()
    }
  }, [user, isLoading, router])
  
  if (isLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#080808]">
        <div className="w-8 h-8 border-t-2 border-[#FFB900] rounded-full animate-spin"></div>
      </div>
    )
  }

  return (
    <div className="p-10">
      <div className="flex justify-between items-center mb-10">
        <h1 className="text-white text-4xl font-bold">Old Proposals</h1>
        
        <Link href="/admin/create" className="px-4 py-2 bg-white rounded-md text-black flex items-center space-x-1">
          <span className="font-medium">Create New</span>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M8 3.33325V12.6666" stroke="black" strokeWidth="1.33" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M3.33301 8H12.6663" stroke="black" strokeWidth="1.33" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </Link>
      </div>
      
      {companies.length === 0 ? (
        <div className="bg-[#121212] border border-white/5 p-6 text-center">
          <p className="text-white text-xl">No expired proposals found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {companies.map((company) => (
            <div key={company.id} className="bg-[#121212] border border-white/5 p-6 flex justify-between items-center">
              <h2 className="text-white text-2xl font-bold">{company.company_name}</h2>
              
              <div className="flex items-center space-x-4">
                <span className="text-white text-2xl">{company.response_count} Responses</span>
                
                <Link 
                  href={`/admin/proposal/${company.id}/responses`}
                  className="ml-6 flex items-center space-x-3 text-[#FFB900]"
                >
                  <span className="text-base">View Now</span>
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
  )
} 