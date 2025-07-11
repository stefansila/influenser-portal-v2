'use client'

import { toast } from 'react-hot-toast'

interface ToastConfirmOptions {
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  onConfirm: () => void
  onCancel?: () => void
  isDestructive?: boolean
}

export const showToastConfirm = ({
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
  isDestructive = false
}: ToastConfirmOptions) => {
  const toastId = toast.custom(
    (t) => (
      <div className="bg-[#121212] border border-white/10 rounded-lg shadow-lg p-4 text-white max-w-md">
        <div className="flex gap-3">
          <div className={`w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-full ${
            isDestructive 
              ? 'bg-red-900/20 text-red-400' 
              : 'bg-amber-900/20 text-[#FFB900]'
          }`}>
            {isDestructive ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M10.29 3.86L1.82 18C1.64 18.32 1.56 18.7 1.58 19.08C1.6 19.46 1.73 19.82 1.95 20.12C2.17 20.42 2.47 20.66 2.82 20.79C3.16 20.93 3.54 20.95 3.9 20.87L12 18.69L20.1 20.87C20.46 20.95 20.84 20.93 21.18 20.79C21.53 20.66 21.83 20.42 22.05 20.12C22.27 19.82 22.4 19.46 22.42 19.08C22.44 18.7 22.36 18.32 22.18 18L13.71 3.86C13.55 3.57 13.3 3.33 13 3.16C12.7 2.99 12.36 2.9 12 2.9C11.64 2.9 11.3 2.99 11 3.16C10.7 3.33 10.45 3.57 10.29 3.86Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            )}
          </div>
          <div className="flex-1">
            <h3 className={`font-medium text-sm mb-1 ${
              isDestructive ? 'text-red-400' : 'text-[#FFB900]'
            }`}>
              {title}
            </h3>
            <p className="text-xs text-gray-300 mb-3">{message}</p>
            
            <div className="flex gap-2">
              <button
                onClick={() => {
                  toast.dismiss(toastId)
                  onCancel?.()
                }}
                className="flex-1 px-3 py-2 text-xs bg-white/5 border border-white/10 text-gray-300 rounded-lg hover:bg-white/10 transition-colors"
              >
                {cancelText}
              </button>
              <button
                onClick={() => {
                  toast.dismiss(toastId)
                  onConfirm()
                }}
                className={`flex-1 px-3 py-2 text-xs rounded-lg transition-colors font-medium ${
                  isDestructive
                    ? 'bg-red-600 hover:bg-red-700 text-white'
                    : 'bg-[#FFB900] hover:bg-[#E6A800] text-black'
                }`}
              >
                {confirmText}
              </button>
            </div>
          </div>
        </div>
      </div>
    ),
    {
      duration: Infinity, // Ne nestaje automatski
      position: 'top-center'
    }
  )

  return toastId
}

export default showToastConfirm 