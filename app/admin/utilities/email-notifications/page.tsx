'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';

type ProcessingResult = {
  success: boolean;
  message: string;
  processed: number;
  successful: number;
  failed: number;
  results?: any[];
};

export default function EmailNotificationsUtility() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastResult, setLastResult] = useState<ProcessingResult | null>(null);

  const processPendingEmails = async (limit: number = 50) => {
    setIsProcessing(true);
    
    try {
      const response = await fetch('/api/notifications/send-bulk-emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          limit,
          process_unprocessed: true
        }),
      });

      const result = await response.json();
      
      if (response.ok) {
        setLastResult(result);
        
        if (result.processed === 0) {
          toast.success('All notifications are up to date!');
        } else {
          toast.success(
            `Processed ${result.processed} notifications. ${result.successful} sent, ${result.failed} failed.`
          );
        }
      } else {
        toast.error(`Failed to process emails: ${result.error}`);
        setLastResult({ 
          success: false, 
          message: result.error,
          processed: 0,
          successful: 0,
          failed: 0
        });
      }
    } catch (error) {
      console.error('Error processing emails:', error);
      toast.error('Error processing emails. Please try again.');
      setLastResult({ 
        success: false, 
        message: 'Network error',
        processed: 0,
        successful: 0,
        failed: 0
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const testSingleEmail = async () => {
    // This will send a test notification email (you could implement this to create a test notification)
    toast('Test email functionality would be implemented here');
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h1 className="text-xl font-semibold text-gray-900">
              Email Notifications Utility
            </h1>
            <p className="mt-1 text-sm text-gray-600">
              Manage and process notification emails for users and admins
            </p>
          </div>

          <div className="p-6">
            <div className="space-y-6">
              {/* Current Status */}
              <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
                <h3 className="text-lg font-medium text-blue-900 mb-2">System Status</h3>
                <div className="text-sm text-blue-700">
                  <p>✅ Email notifications are automatically sent for new notifications</p>
                  <p>✅ Both user and admin notifications trigger emails</p>
                  <p>✅ SendGrid integration is active</p>
                  <p>📧 Email templates include beautiful HTML and plain text versions</p>
                </div>
              </div>

              {/* Processing Controls */}
              <div className="bg-gray-50 border border-gray-200 rounded-md p-4">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Process Pending Emails</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Process any notifications that might have missed automatic email sending.
                </p>
                
                <div className="flex space-x-4">
                  <button
                    onClick={() => processPendingEmails(25)}
                    disabled={isProcessing}
                    className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isProcessing ? 'Processing...' : 'Process 25 Pending'}
                  </button>
                  
                  <button
                    onClick={() => processPendingEmails(50)}
                    disabled={isProcessing}
                    className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isProcessing ? 'Processing...' : 'Process 50 Pending'}
                  </button>
                  
                  <button
                    onClick={() => processPendingEmails(100)}
                    disabled={isProcessing}
                    className="bg-yellow-600 text-white px-4 py-2 rounded-md hover:bg-yellow-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isProcessing ? 'Processing...' : 'Process 100 Pending'}
                  </button>
                </div>
              </div>

              {/* Last Processing Result */}
              {lastResult && (
                <div className={`border rounded-md p-4 ${
                  lastResult.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
                }`}>
                  <h3 className={`text-lg font-medium mb-2 ${
                    lastResult.success ? 'text-green-900' : 'text-red-900'
                  }`}>
                    Last Processing Result
                  </h3>
                  <div className={`text-sm ${
                    lastResult.success ? 'text-green-700' : 'text-red-700'
                  }`}>
                    <p><strong>Status:</strong> {lastResult.success ? 'Success' : 'Failed'}</p>
                    <p><strong>Message:</strong> {lastResult.message}</p>
                    <p><strong>Processed:</strong> {lastResult.processed}</p>
                    <p><strong>Successful:</strong> {lastResult.successful}</p>
                    <p><strong>Failed:</strong> {lastResult.failed}</p>
                  </div>

                  {lastResult.results && lastResult.results.length > 0 && (
                    <div className="mt-4">
                      <h4 className="font-medium mb-2">Details:</h4>
                      <div className="max-h-40 overflow-y-auto">
                        {lastResult.results.map((result: any, index: number) => (
                          <div key={index} className={`text-xs p-2 mb-1 rounded ${
                            result.success ? 'bg-green-100' : 'bg-red-100'
                          }`}>
                            <span className="font-mono">{result.user_email}</span>
                            {result.error && <span className="ml-2 text-red-600">- {result.error}</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Information */}
              <div className="bg-gray-50 border border-gray-200 rounded-md p-4">
                <h3 className="text-lg font-medium text-gray-900 mb-2">How It Works</h3>
                <div className="text-sm text-gray-600 space-y-2">
                  <p>
                    <strong>Automatic Email Sending:</strong> When new notifications are created, 
                    the system automatically sends email notifications to users and admins.
                  </p>
                  <p>
                    <strong>Notification Types:</strong> All notification types are supported:
                  </p>
                  <ul className="list-disc list-inside ml-4 space-y-1">
                    <li>📢 New Proposal Available</li>
                    <li>📝 Proposal Updated</li>
                    <li>✋ New Response Submitted</li>
                    <li>🔄 Response Updated</li>
                    <li>👨‍💼 Admin Response to User Reply</li>
                    <li>🎯 Campaign Completed</li>
                  </ul>
                  <p>
                    <strong>Email Templates:</strong> Each notification type has a customized 
                    email template with contextual content, proper styling, and clear call-to-action buttons.
                  </p>
                  <p>
                    <strong>Tracking:</strong> All email sending attempts are tracked in the database 
                    with success/failure status and error details.
                  </p>
                </div>
              </div>

              {/* Navigation */}
              <div className="flex justify-between">
                <a
                  href="/admin"
                  className="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700"
                >
                  ← Back to Admin
                </a>
                
                <a
                  href="/api/admin/test-sendgrid"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700"
                >
                  Test SendGrid Config ↗
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 