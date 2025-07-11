import { supabase } from '../lib/supabase'

export async function uploadSignature(
  signatureDataURL: string,
  userId: string,
  proposalId: string
): Promise<string | null> {
  try {
    // Convert data URL to blob
    const response = await fetch(signatureDataURL)
    const blob = await response.blob()
    
    // Create unique filename
    const timestamp = new Date().getTime()
    const fileName = `${userId}/${proposalId}_${timestamp}.png`
    
    // Upload to Supabase storage
    const { data, error } = await supabase.storage
      .from('signatures')
      .upload(fileName, blob, {
        contentType: 'image/png',
        upsert: false
      })
    
    if (error) {
      console.error('Error uploading signature:', error)
      return null
    }
    
    // Get public URL for public bucket
    const { data: urlData } = supabase.storage
      .from('signatures')
      .getPublicUrl(fileName)
    
    return urlData.publicUrl
  } catch (error) {
    console.error('Error processing signature:', error)
    return null
  }
}

export async function getSignatureUrl(filePath: string): Promise<string | null> {
  try {
    // For public bucket, just get public URL
    const { data } = supabase.storage
      .from('signatures')
      .getPublicUrl(filePath)
    
    return data.publicUrl
  } catch (error) {
    console.error('Error getting public URL:', error)
    return null
  }
}

export async function deleteSignature(signatureUrl: string): Promise<boolean> {
  try {
    // If it's a file path (not a full URL), use it directly
    let fileName = signatureUrl
    
    // If it's a full URL, extract file path
    if (signatureUrl.startsWith('http')) {
      const url = new URL(signatureUrl)
      const pathParts = url.pathname.split('/')
      fileName = pathParts.slice(-2).join('/') // Get userId/filename part
    }
    
    const { error } = await supabase.storage
      .from('signatures')
      .remove([fileName])
    
    if (error) {
      console.error('Error deleting signature:', error)
      return false
    }
    
    return true
  } catch (error) {
    console.error('Error processing signature deletion:', error)
    return false
  }
} 