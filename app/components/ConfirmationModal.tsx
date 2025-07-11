'use client'

interface ConfirmationModalProps {
  isOpen: boolean
  title: string
  message: string
  confirmText: string
  cancelText: string
  onConfirm: () => void
  onCancel: () => void
  isDestructive?: boolean
}

export default function ConfirmationModal({
  isOpen,
  title,
  message,
  confirmText,
  cancelText,
  onConfirm,
  onCancel,
  isDestructive = false
}: ConfirmationModalProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
      <div className="bg-[#121212] border border-white/10 rounded-lg w-full max-w-md overflow-hidden">
        <div className="p-6">
          <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
          <p className="text-gray-300 mb-6">{message}</p>
          
          <div className="flex space-x-4">
            <button
              onClick={onCancel}
              className="flex-1 px-4 py-3 border border-white/10 text-white rounded-full hover:bg-white/5 transition-colors"
            >
              {cancelText}
            </button>
            <button
              onClick={onConfirm}
              className={`flex-1 px-4 py-3 rounded-full ${
                isDestructive
                  ? 'bg-red-600 hover:bg-red-700 text-white'
                  : 'bg-[#FFB900] hover:bg-[#E6A800] text-black'
              } transition-colors`}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
} 