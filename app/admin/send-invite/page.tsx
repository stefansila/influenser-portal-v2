'use client'

import { useState, useEffect } from 'react'

interface Tag {
  id: string;
  name: string;
  color: string;
}

export default function SendInvitePage() {
  const [emails, setEmails] = useState('')
  const [selectedTagId, setSelectedTagId] = useState('')
  const [tags, setTags] = useState<Tag[]>([])
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [logs, setLogs] = useState<string[]>([])
  const [results, setResults] = useState<any[]>([])

  const addLog = (log: string) => {
    setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${log}`]);
  }

  // Load tags on component mount
  useEffect(() => {
    const loadTags = async () => {
      try {
        const response = await fetch('/api/admin/tags');
        if (response.ok) {
          const data = await response.json();
          setTags(data.tags || []);
        }
      } catch (err) {
        console.error('Error loading tags:', err);
      }
    };
    
    loadTags();
  }, []);

  const validateEmails = (emailString: string): string[] => {
    const emailList = emailString
      .split(',')
      .map(email => email.trim())
      .filter(email => email.length > 0);
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const validEmails: string[] = [];
    const invalidEmails: string[] = [];
    
    emailList.forEach(email => {
      if (emailRegex.test(email)) {
        validEmails.push(email);
      } else {
        invalidEmails.push(email);
      }
    });
    
    if (invalidEmails.length > 0) {
      addLog(`Invalid emails found: ${invalidEmails.join(', ')}`);
    }
    
    return validEmails;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!emails.trim()) {
      setError('At least one email is required')
      return
    }
    
    if (!selectedTagId) {
      setError('Please select a tag')
      return
    }
    
    const validEmails = validateEmails(emails);
    
    if (validEmails.length === 0) {
      setError('No valid emails found')
      return
    }
    
    setLoading(true)
    setError(null)
    setMessage(null)
    setResults([])
    setLogs([])
    
    const selectedTag = tags.find(tag => tag.id === selectedTagId);
    
    try {
      addLog(`Starting bulk invitation process for ${validEmails.length} emails with tag: ${selectedTag?.name}`);
      
      const response = await fetch('/api/admin/bulk-invite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          emails: validEmails,
          tagId: selectedTagId 
        }),
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to send invitations');
      }
      
      addLog(`Server response received`);
      
      if (result.success) {
        setResults(result.results || []);
        setMessage(`Processed ${validEmails.length} invitations. Check results below.`);
        
        // Log summary
        const successful = result.results?.filter((r: any) => r.success).length || 0;
        const failed = result.results?.filter((r: any) => !r.success).length || 0;
        addLog(`Summary: ${successful} successful, ${failed} failed`);
      } else {
        throw new Error('Unknown error when sending invitations');
      }
    } catch (err: any) {
      console.error('Error sending invitations:', err);
      setError(err.message || 'Failed to send invitations');
      addLog(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  const copyAllUrls = () => {
    const urls = results
      .filter(r => r.success && r.registration_url)
      .map(r => `${r.email}: ${r.registration_url}`)
      .join('\n');
    
    if (urls) {
      navigator.clipboard.writeText(urls);
      addLog('All registration URLs copied to clipboard');
    }
  };



  return (
    <div className="min-h-[90svh] flex items-center justify-center bg-background px-4 py-8">
      <div className="max-w-4xl w-full rounded-lg bg-inputBg p-8 shadow-lg">
        <h1 className="text-2xl font-bold text-textPrimary mb-6">Send Bulk Invitations</h1>
        
        {error && (
          <div className="mb-4 p-4 bg-red-900/30 border border-red-500/30 rounded-md text-red-200 text-sm">
            {error}
          </div>
        )}
        
        {message && (
          <div className="mb-4 p-4 bg-green-900/30 border border-green-500/30 rounded-md text-green-200 text-sm">
            {message}
          </div>
        )}
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="emails" className="block text-sm font-medium text-textSecondary mb-2">
              Email Addresses
            </label>
            <textarea
              id="emails"
              value={emails}
              onChange={(e) => setEmails(e.target.value)}
              placeholder="Enter email addresses separated by commas&#10;Example: user1@example.com, user2@example.com, user3@example.com"
              className="w-full px-4 py-3 bg-inputBg border border-white/20 rounded-md text-textPrimary placeholder-textTertiary focus:outline-none focus:ring-2 focus:ring-[#FFB900] focus:border-transparent resize-vertical"
              rows={4}
              required
            />
            <p className="mt-1 text-xs text-textTertiary">
              Separate multiple email addresses with commas. Invalid emails will be automatically filtered out.
            </p>
          </div>
          
          <div>
            <label htmlFor="tag" className="block text-sm font-medium text-textSecondary mb-2">
              User Tag
            </label>
            <select
              id="tag"
              value={selectedTagId}
              onChange={(e) => setSelectedTagId(e.target.value)}
              className="select-field focus:ring-2 focus:ring-[#FFB900] focus:border-transparent"
              required
            >
              <option value="">Select a tag for invited users</option>
              {tags.map(tag => (
                <option key={tag.id} value={tag.id}>
                  {tag.name}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-textTertiary">
              This tag will be applied to all users who register using these invitations.
            </p>
          </div>
          
          <button
            type="submit"
            disabled={loading}
            className={`w-full px-4 py-3 bg-[#FFB900] text-buttonText font-medium rounded-md transition-colors hover:bg-[#FFC933] focus:outline-none focus:ring-2 focus:ring-[#FFB900] focus:ring-offset-2 focus:ring-offset-background ${
              loading ? 'opacity-70 cursor-not-allowed' : ''
            }`}
          >
            {loading ? 'Sending Invitations...' : 'Send Invitations'}
          </button>
        </form>
        
        {results.length > 0 && (
          <div className="mt-8">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-textPrimary">Invitation Results</h3>
              <button
                onClick={copyAllUrls}
                className="px-4 py-2 bg-[#FFB900] text-buttonText font-medium rounded-md hover:bg-[#FFC933] transition-colors text-sm"
              >
                Copy All URLs
              </button>
            </div>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {results.map((result, idx) => (
                <div 
                  key={idx} 
                  className={`p-4 rounded-md border ${
                    result.success 
                      ? 'bg-green-900/20 border-green-500/30' 
                      : 'bg-red-900/20 border-red-500/30'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className={`w-3 h-3 rounded-full mr-3 ${
                        result.success ? 'bg-green-500' : 'bg-red-500'
                      }`}></div>
                      <span className="text-textPrimary font-medium">{result.email}</span>
                    </div>
                    {result.success && result.registration_url && (
                      <button
                        onClick={() => navigator.clipboard.writeText(result.registration_url)}
                        className="px-3 py-1 bg-[#FFB900] text-buttonText text-xs rounded hover:bg-[#FFC933] transition-colors"
                      >
                        Copy URL
                      </button>
                    )}
                  </div>
                  
                  {result.success ? (
                    <div className="mt-2 text-sm text-green-200">
                      <p>✓ Invitation created successfully</p>
                      <p>✓ Email sent: {result.email_sent ? 'Yes' : 'No'}</p>
                      {!result.email_sent && result.email_error && (
                        <p className="text-yellow-300">⚠ Email error: {result.email_error}</p>
                      )}
                      {result.registration_url && (
                        <p className="mt-1 text-xs text-green-300 break-all">
                          URL: {result.registration_url}
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="mt-2 text-sm text-red-200">
                      <p>✗ {result.error || 'Failed to create invitation'}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
        
        {logs.length > 0 && (
          <div className="mt-8">
            <h3 className="text-lg font-medium text-textPrimary mb-3">Process Logs</h3>
            <div className="bg-background p-4 rounded-md h-60 overflow-y-auto">
              {logs.map((log, idx) => (
                <div key={idx} className="mb-1 text-textSecondary text-sm font-mono">
                  {log}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
} 