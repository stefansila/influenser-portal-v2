'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '../../../../context/AuthContext'
import { supabase } from '../../../../lib/supabase'
import dynamic from 'next/dynamic'
import UserSelector from '../../../../components/UserSelector'
import TagSelector from '../../../../components/TagSelector'

// Dynamically import Quill to avoid SSR issues
const ReactQuill = dynamic(() => import('react-quill'), { 
  ssr: false,
  loading: () => <p>Loading editor...</p>
})

// Import Quill styles
import 'react-quill/dist/quill.snow.css'
// Import custom editor styles
import '../../../create-proposal/editor.css'

type FormData = {
  title: string,
  company_name: string,
  campaign_start_date: string,
  campaign_end_date: string,
  short_description: string,
  content: string,
  email_template_body: string
}

export default function EditProposal() {
  const { user } = useAuth()
  const router = useRouter()
  const { id } = useParams()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [currentLogoUrl, setCurrentLogoUrl] = useState<string | null>(null)
  const [logoChanged, setLogoChanged] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [selectedUsers, setSelectedUsers] = useState<string[]>([])
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [usersFromTags, setUsersFromTags] = useState<string[]>([])
  
  const [formData, setFormData] = useState<FormData>({
    title: '',
    company_name: '',
    campaign_start_date: '',
    campaign_end_date: '',
    short_description: '',
    content: '',
    email_template_body: ''
  })
  
  // State to track if the component is mounted (for client-side rendering)
  const [isMounted, setIsMounted] = useState(false)
  
  // Set mounted state when component mounts
  useEffect(() => {
    setIsMounted(true)
  }, [])

  // Fetch the proposal data
  useEffect(() => {
    const fetchProposalDetails = async () => {
      if (!user) {
        router.push('/login')
        return
      }

      try {
        // Fetch proposal details
        const { data: proposalData, error: proposalError } = await supabase
          .from('proposals')
          .select('*')
          .eq('id', id)
          .single()
        
        if (proposalError) {
          console.error('Error fetching proposal details:', proposalError)
          // Use default values if error
          setIsLoading(false)
          return
        }
        
        // Set form data from fetched proposal
        setFormData({
          title: proposalData.title || '',
          company_name: proposalData.company_name || '',
          campaign_start_date: proposalData.campaign_start_date || '',
          campaign_end_date: proposalData.campaign_end_date || '',
          short_description: proposalData.short_description || '',
          content: proposalData.content?.html || '',
          email_template_body: proposalData.email_template_body || ''
        })
        
        // Set logo preview if available
        if (proposalData.logo_url) {
          setCurrentLogoUrl(proposalData.logo_url)
          setLogoPreview(proposalData.logo_url)
        }
        
        // Fetch the users who can see this proposal
        const { data: visibilityData, error: visibilityError } = await supabase
          .from('proposal_visibility')
          .select('user_id')
          .eq('proposal_id', id)
        
        if (visibilityError) {
          console.error('Error fetching proposal visibility:', visibilityError)
        } else {
          // Set selected users
          setSelectedUsers(visibilityData.map(item => item.user_id))
        }
        
        setIsLoading(false)
      } catch (error) {
        console.error('Error:', error)
        setIsLoading(false)
      }
    }

    if (user) {
      fetchProposalDetails()
    }
    
    setIsMounted(true)
  }, [id, user, router])
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData({
      ...formData,
      [name]: value
    })
    
    // Clear error when user makes changes
    if (error) setError('')
  }

  // Handle file input change
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0]
      
      // Basic validation - check if it's an image
      if (!file.type.match('image.*')) {
        setError('Please select an image file (jpg, png, etc.)')
        return
      }
      
      // Size validation (limit to 2MB)
      if (file.size > 2 * 1024 * 1024) {
        setError('Image size should be less than 2MB')
        return
      }
      
      setLogoFile(file)
      setLogoChanged(true)
      
      // Create preview URL for the image
      const reader = new FileReader()
      reader.onload = (e) => {
        setLogoPreview(e.target?.result as string)
      }
      reader.readAsDataURL(file)
      
      // Clear any previous errors
      setError('')
    }
  }

  // Handle logo removal
  const handleRemoveLogo = () => {
    setLogoFile(null)
    setLogoPreview(null)
    setLogoChanged(true)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  // Handle rich text editor content change
  const handleRichTextChange = (content: string) => {
    setFormData({
      ...formData,
      content
    })
    
    // Clear error when user makes changes
    if (error) setError('')
  }

  // Handle email template rich text editor content change
  const handleEmailTemplateRichTextChange = (content: string) => {
    setFormData({
      ...formData,
      email_template_body: content
    })
    
    // Clear error when user makes changes
    if (error) setError('')
  }
  
  // Handle user selection change
  const handleUserSelectionChange = useCallback((userIds: string[]) => {
    setSelectedUsers(userIds)
  }, [])

  // Handle tag selection change
  const handleTagSelectionChange = useCallback((tagIds: string[]) => {
    setSelectedTags(tagIds)
  }, [])

  // Handle users from tags change
  const handleUsersFromTagsChange = useCallback((userIds: string[]) => {
    setUsersFromTags(userIds)
  }, [])
  
  // Validate dates before submission
  const validateDates = (): boolean => {
    // Clear any existing errors
    setError('')
    
    const { campaign_start_date, campaign_end_date } = formData
    
    // Ensure both dates are provided
    if (!campaign_start_date || !campaign_end_date) {
      setError('Both start and end dates are required')
      return false
    }
    
    // Compare dates
    const startDate = new Date(campaign_start_date)
    const endDate = new Date(campaign_end_date)
    const today = new Date()
    today.setHours(0, 0, 0, 0) // Reset time to start of day for accurate comparison
    
    // Check if start date is in the past
    if (startDate < today) {
      setError('Campaign start date cannot be in the past')
      return false
    }
    
    if (endDate < startDate) {
      setError('Campaign end date must be after start date')
      return false
    }
    
    return true
  }
  
  // Validate user selection
  const validateUserSelection = (): boolean => {
    if (selectedUsers.length === 0) {
      setError('Please select at least one user to view this proposal')
      return false
    }
    return true
  }
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!user) return
    
    // Validate dates before proceeding
    if (!validateDates()) return
    
    // Validate user selection
    if (!validateUserSelection()) return
    
    setIsSubmitting(true)
    
    try {
      // Store the original selected users before making changes
      const originalSelectedUsers = [...selectedUsers]
      
      let logo_url = currentLogoUrl;
      
      // Upload the logo file if one is selected
      if (logoFile) {
        const fileExt = logoFile.name.split('.').pop()
        const fileName = `${Math.random().toString(36).substring(2, 15)}.${fileExt}`
        const filePath = `logos/${fileName}`
        
        const { error: uploadError, data } = await supabase.storage
          .from('company-logos')
          .upload(filePath, logoFile)
          
        if (uploadError) throw uploadError
        
        // Get public URL for the uploaded file
        const { data: { publicUrl } } = supabase.storage
          .from('company-logos')
          .getPublicUrl(filePath)
          
        logo_url = publicUrl
      }

      // Process content to handle any base64 encoded images and upload them to Supabase
      let processedContent = formData.content

      // Find all base64 images in the content
      const tempDiv = document.createElement('div')
      tempDiv.innerHTML = processedContent
      const base64Images = tempDiv.querySelectorAll('img[src^="data:image"]')

      // Upload each base64 image to Supabase storage
      for (let i = 0; i < base64Images.length; i++) {
        const img = base64Images[i] as HTMLImageElement
        try {
          // Convert base64 to blob
          const response = await fetch(img.src)
          const blob = await response.blob()
          
          // Generate unique filename
          const fileExt = blob.type.split('/')[1] || 'png'
          const fileName = `rich-text-${Date.now()}-${i}.${fileExt}`
          
          // Upload to Supabase storage
          const { error: uploadError } = await supabase.storage
            .from('rich-text')
            .upload(fileName, blob)
          
          if (uploadError) throw uploadError
          
          // Get public URL for the uploaded file
          const { data: { publicUrl } } = supabase.storage
            .from('rich-text')
            .getPublicUrl(fileName)
          
          // Replace the base64 src with the new URL in the original image
          img.src = publicUrl
        } catch (error) {
          console.error('Error uploading base64 image:', error)
        }
      }
      
      // Get the updated HTML content with replaced image URLs
      processedContent = tempDiv.innerHTML

      // Process email template body to handle any base64 encoded images and upload them to Supabase
      let processedEmailTemplateBody = formData.email_template_body

      // Find all base64 images in the email template body
      const emailTempDiv = document.createElement('div')
      emailTempDiv.innerHTML = processedEmailTemplateBody
      const emailBase64Images = emailTempDiv.querySelectorAll('img[src^="data:image"]')

      // Upload each base64 image to Supabase storage
      for (let i = 0; i < emailBase64Images.length; i++) {
        const img = emailBase64Images[i] as HTMLImageElement
        try {
          // Convert base64 to blob
          const response = await fetch(img.src)
          const blob = await response.blob()
          
          // Generate unique filename
          const fileExt = blob.type.split('/')[1] || 'png'
          const fileName = `email-template-${Date.now()}-${i}.${fileExt}`
          
          // Upload to Supabase storage
          const { error: uploadError } = await supabase.storage
            .from('rich-text')
            .upload(fileName, blob)
          
          if (uploadError) throw uploadError
          
          // Get public URL for the uploaded file
          const { data: { publicUrl } } = supabase.storage
            .from('rich-text')
            .getPublicUrl(fileName)
          
          // Replace the base64 src with the new URL in the original image
          img.src = publicUrl
        } catch (error) {
          console.error('Error uploading base64 image in email template:', error)
        }
      }
      
      // Get the updated HTML content with replaced image URLs
      processedEmailTemplateBody = emailTempDiv.innerHTML
      
      // Prepare a more structured content for jsonb storage
      const contentJson = {
        type: 'rich-text',
        html: processedContent, // Store the processed HTML content
        blocks: [
          {
            type: 'html',
            content: processedContent
          }
        ]
      }
      
      // Get the current visibility before making changes
      const { data: currentVisibilityData, error: currentVisibilityError } = await supabase
        .from('proposal_visibility')
        .select('user_id')
        .eq('proposal_id', id)
      
      if (currentVisibilityError) {
        console.error('Error fetching current visibility:', currentVisibilityError)
        throw currentVisibilityError
      }
      
      const currentUserIds = currentVisibilityData?.map(item => item.user_id) || []
      
      // Update the proposal
      const { error: updateError } = await supabase
        .from('proposals')
        .update({
          title: formData.title,
          logo_url,
          company_name: formData.company_name,
          campaign_start_date: formData.campaign_start_date,
          campaign_end_date: formData.campaign_end_date,
          short_description: formData.short_description,
          content: contentJson,
          email_template_body: processedEmailTemplateBody
        })
        .eq('id', id)
      
      if (updateError) throw updateError
      
      // Update the proposal visibility
      // First delete all existing records
      const { error: deleteError } = await supabase
        .from('proposal_visibility')
        .delete()
        .eq('proposal_id', id)
      
      if (deleteError) {
        console.error('Error deleting existing visibility records:', deleteError)
        throw deleteError
      }
      
      // Then insert new records
      const visibilityRecords = selectedUsers.map(userId => ({
        proposal_id: id,
        user_id: userId
      }))
      
      const { error: visibilityError } = await supabase
        .from('proposal_visibility')
        .insert(visibilityRecords)
      
      if (visibilityError) {
        console.error('Error setting proposal visibility:', visibilityError)
        throw visibilityError
      }
      
      // Handle notifications manually using our custom function
      const { error: notificationError } = await supabase.rpc('handle_proposal_visibility_update', {
        p_proposal_id: id,
        p_old_user_ids: currentUserIds,
        p_new_user_ids: selectedUsers
      })
      
      if (notificationError) {
        console.error('Error handling notifications:', notificationError)
        // Don't throw here - notifications are not critical for the main operation
      }

      // Send advertising opportunity email to new users if email template body is provided
      if (formData.email_template_body && formData.email_template_body.trim()) {
        // Find users who are newly added (not in currentUserIds)
        const newUsers = selectedUsers.filter(userId => !currentUserIds.includes(userId))
        
        if (newUsers.length > 0) {
          try {
            const emailResponse = await fetch('/api/admin/send-advertising-email', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                proposalId: id,
                userIds: newUsers
              }),
            })
            
            const emailResult = await emailResponse.json()
            
            if (emailResponse.ok) {
              console.log('Advertising opportunity emails sent to new users:', emailResult)
            } else {
              console.error('Failed to send advertising opportunity emails:', emailResult.error)
              // Don't throw here - email sending is not critical for the main operation
            }
          } catch (emailError) {
            console.error('Error sending advertising opportunity emails:', emailError)
            // Don't throw here - email sending is not critical for the main operation
          }
        }
      }
      
      // Redirect back to admin dashboard on success
      router.push('/admin')
    } catch (error: any) {
      console.error('Error updating proposal:', error)
      
      // Handle specific database constraint errors
      if (error.code === '23514' && error.message.includes('date_check')) {
        setError('Invalid date range. End date must be after start date.')
      } else {
        setError(error.message || 'Failed to update proposal. Please try again.')
      }
    } finally {
      setIsSubmitting(false)
    }
  }
  
  // Quill editor configuration
  const modules = {
    toolbar: [
      [{ 'header': [1, 2, 3, false] }],
      ['bold', 'italic', 'underline', 'strike'],
      [{ 'list': 'ordered'}, { 'list': 'bullet' }],
      ['link', 'image'],
      ['clean']
    ],
  }
  
  const formats = [
    'header',
    'bold', 'italic', 'underline', 'strike',
    'list', 'bullet',
    'link', 'image'
  ]
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#080808]">
        <div className="w-8 h-8 border-t-2 border-[#FFB900] rounded-full animate-spin"></div>
      </div>
    )
  }
  
  return (
    <div className="p-10 max-w-4xl mx-auto">
      <div className="mb-10 flex items-center space-x-4">
        <Link href={`/admin/proposal/${id}/responses`} className="text-[#FFB900]">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M19 12H5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M12 19L5 12L12 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </Link>
        <h1 className="text-white text-3xl font-bold">Edit Proposal</h1>
      </div>
      
      {error && (
        <div className="mb-6 p-4 bg-red-900/20 border border-red-500/50 text-red-500 rounded-md">
          {error}
        </div>
      )}
      
      <form onSubmit={handleSubmit} className="space-y-6 bg-[#121212] border border-white/5 p-8 rounded-md">
        <div className="space-y-4">
          <div>
            <label htmlFor="title" className="block text-sm text-[#FFB900] mb-2">Proposal Title</label>
            <input
              id="title"
              name="title"
              type="text"
              required
              value={formData.title}
              onChange={handleChange}
              className="w-full px-3 py-4 rounded-lg bg-[rgba(255,255,255,0.04)] border border-white/20 focus:outline-none text-white"
              placeholder="Enter proposal title"
            />
          </div>
          
          <div>
            <label htmlFor="logo" className="block text-sm text-[#FFB900] mb-2">Company Logo</label>
            <div className="mt-1">
              {(logoPreview || currentLogoUrl) && (
                <div className="mb-3 relative">
                  <img 
                    src={logoPreview || currentLogoUrl || ''} 
                    alt="Logo preview" 
                    className="h-32 object-contain bg-white/5 rounded-md p-2" 
                  />
                  <button
                    type="button"
                    onClick={handleRemoveLogo}
                    className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                </div>
              )}
              
              {!logoPreview && !currentLogoUrl && (
                <div className="flex items-center justify-center w-full">
                  <label htmlFor="logo_file" className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed rounded-lg cursor-pointer border-white/20 bg-[rgba(255,255,255,0.04)] hover:bg-[rgba(255,255,255,0.08)]">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="mb-3 text-gray-400">
                        <path d="M7 16.5V17.85C7 19.05 8.35 20 10 20H14C15.65 20 17 19.05 17 17.85V16.5M12 4V16M12 4L8 8M12 4L16 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      <p className="mb-2 text-sm text-gray-400">
                        <span className="font-semibold">Click to upload</span> or drag and drop
                      </p>
                      <p className="text-xs text-gray-400">PNG, JPG (MAX. 2MB)</p>
                    </div>
                    <input 
                      id="logo_file" 
                      ref={fileInputRef}
                      type="file" 
                      className="hidden" 
                      accept="image/*"
                      onChange={handleFileChange}
                    />
                  </label>
                </div>
              )}
            </div>
          </div>
          
          <div>
            <label htmlFor="company_name" className="block text-sm text-[#FFB900] mb-2">Company Name</label>
            <input
              id="company_name"
              name="company_name"
              type="text"
              required
              value={formData.company_name}
              onChange={handleChange}
              className="w-full px-3 py-4 rounded-lg bg-[rgba(255,255,255,0.04)] border border-white/20 focus:outline-none text-white"
              placeholder="Enter company name"
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="campaign_start_date" className="block text-sm text-[#FFB900] mb-2">Campaign Start Date</label>
              <input
                id="campaign_start_date"
                name="campaign_start_date"
                type="date"
                required
                value={formData.campaign_start_date}
                onChange={handleChange}
                min={new Date().toISOString().split('T')[0]} // Cannot be in the past
                max={formData.campaign_end_date || undefined} // Cannot be after end date
                className="date-input-field"
              />
              <p className="text-xs text-gray-400 mt-1">Cannot be in the past</p>
            </div>
            
            <div>
              <label htmlFor="campaign_end_date" className="block text-sm text-[#FFB900] mb-2">Campaign End Date</label>
              <input
                id="campaign_end_date"
                name="campaign_end_date"
                type="date"
                required
                value={formData.campaign_end_date}
                onChange={handleChange}
                min={formData.campaign_start_date || new Date().toISOString().split('T')[0]} // Must be after start date or today
                className="date-input-field"
              />
              <p className="text-xs text-gray-400 mt-1">Must be after start date</p>
            </div>
          </div>
          
          <div>
            <label htmlFor="short_description" className="block text-sm text-[#FFB900] mb-2">Short Description</label>
            <textarea
              id="short_description"
              name="short_description"
              required
              value={formData.short_description}
              onChange={handleChange}
              className="w-full px-3 py-4 rounded-lg bg-[rgba(255,255,255,0.04)] border border-white/20 focus:outline-none text-white h-24"
              placeholder="Enter a brief description of the proposal"
            />
          </div>
          
          <div>
            <label htmlFor="email_template_body" className="block text-sm text-[#FFB900] mb-2">Email Template Body (Rich Text)</label>
            {isMounted && (
              <div className="rich-text-editor-container">
                <ReactQuill
                  theme="snow"
                  value={formData.email_template_body}
                  onChange={handleEmailTemplateRichTextChange}
                  modules={modules}
                  formats={formats}
                  className="bg-[rgba(255,255,255,0.04)] text-white rounded-lg border border-white/20"
                  placeholder="Enter the campaign details that will be sent in the advertising opportunity email to users..."
                />
              </div>
            )}
            <p className="text-xs text-gray-400 mt-1">
              This content will be included in the advertising opportunity email sent to users. 
              Include campaign details like sponsor info, platform requirements, timeline, talking points, etc.
            </p>
          </div>
          
          <div>
            <label htmlFor="content" className="block text-sm text-[#FFB900] mb-2">Full Content (Rich Text)</label>
            {isMounted && (
              <div className="rich-text-editor-container">
                <ReactQuill
                  theme="snow"
                  value={formData.content}
                  onChange={handleRichTextChange}
                  modules={modules}
                  formats={formats}
                  className="bg-[rgba(255,255,255,0.04)] text-white rounded-lg border border-white/20"
                  placeholder="Enter rich text content here..."
                />
              </div>
            )}
          </div>
          
          <div>
            <TagSelector 
              selectedTags={selectedTags}
              onChange={handleTagSelectionChange}
              onUsersFromTagsChange={handleUsersFromTagsChange}
            />
          </div>

          <div>
            <UserSelector 
              selectedUsers={selectedUsers}
              onChange={handleUserSelectionChange}
              usersFromTags={usersFromTags}
            />
          </div>
        </div>
        
        <div className="flex justify-end space-x-4 mt-16">
          <Link 
            href={`/admin/proposal/${id}/responses`}
            className="px-6 py-3 rounded-full border border-white/20 text-white"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={isSubmitting}
            className="primary-button px-8 py-3 bg-white rounded-full flex items-center space-x-3"
          >
            <span className="text-[#100E0D] font-medium">{isSubmitting ? 'Updating...' : 'Update Proposal'}</span>
            {!isSubmitting && (
              <svg width="7" height="14" viewBox="0 0 7 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M1 1L6 7L1 13" stroke="#131110" strokeWidth="1.67" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            )}
          </button>
        </div>
      </form>
    </div>
  )
} 