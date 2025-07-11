'use client'

import { useRef, useState, useEffect } from 'react'
import SignatureCanvas from 'react-signature-canvas'

interface ESignatureProps {
  onSignatureChange: (signatureDataURL: string | null) => void
  disabled?: boolean
  existingSignature?: string | null
}

export default function ESignature({ onSignatureChange, disabled = false, existingSignature }: ESignatureProps) {
  const sigCanvas = useRef<SignatureCanvas>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [hasSignature, setHasSignature] = useState(!!existingSignature)
  const [canvasSize, setCanvasSize] = useState({ width: 300, height: 120 })

  useEffect(() => {
    const updateCanvasSize = () => {
      if (containerRef.current) {
        const containerWidth = containerRef.current.offsetWidth - 16 // Subtract padding (reduced from 32)
        const width = Math.min(containerWidth, 300) // Max width 300px (reduced from 400)
        const height = 120 // Fixed height (reduced from 150)
        setCanvasSize({ width, height })
      }
    }

    updateCanvasSize()
    window.addEventListener('resize', updateCanvasSize)
    return () => window.removeEventListener('resize', updateCanvasSize)
  }, [])

  const clearSignature = () => {
    if (disabled) return
    sigCanvas.current?.clear()
    setHasSignature(false)
    onSignatureChange(null)
  }

  const handleSignatureEnd = () => {
    if (disabled) return
    if (sigCanvas.current?.isEmpty()) {
      setHasSignature(false)
      onSignatureChange(null)
    } else {
      const dataURL = sigCanvas.current?.toDataURL()
      setHasSignature(true)
      onSignatureChange(dataURL || null)
    }
  }

  if (existingSignature && disabled) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <label className="block text-sm text-[#FFB900]">
            Digital Signature
          </label>
          <span className="text-xs text-green-500 flex items-center">
            <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            Signed
          </span>
        </div>
        <div className="bg-[#080808] border border-green-500/30 rounded-lg p-4">
          <img 
            src={existingSignature} 
            alt="Digital Signature" 
            className="max-w-full h-auto bg-white rounded max-h-40"
            onError={(e) => {
              console.error('Error loading signature image:', existingSignature)
              e.currentTarget.style.display = 'none'
            }}
          />
        </div>
        <p className="text-xs text-gray-400">
          This document has been digitally signed and cannot be modified.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <label className="block text-sm text-[#FFB900]">
          Digital Signature *
        </label>
        {hasSignature && (
          <button
            type="button"
            onClick={clearSignature}
            disabled={disabled}
            className="text-xs text-red-400 hover:text-red-300 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Clear Signature
          </button>
        )}
      </div>
      
      <div ref={containerRef} className="bg-[#080808] border border-white/10 rounded-lg p-2 inline-block">
        <div className="bg-white rounded border-2 border-dashed border-gray-300 inline-block">
          <SignatureCanvas
            ref={sigCanvas}
            canvasProps={{
              width: canvasSize.width,
              height: canvasSize.height,
              className: 'signature-canvas'
            }}
            onEnd={handleSignatureEnd}
            backgroundColor="white"
            penColor="black"
          />
        </div>
        
        <div className="mt-2 text-center">
          <p className="text-xs text-gray-400">
            {hasSignature 
              ? "Signature captured. You can clear and sign again if needed."
              : "Please sign above using your mouse, trackpad, or touch screen."
            }
          </p>
        </div>
      </div>
      
      {!hasSignature && (
        <p className="text-red-500 text-sm">
          Digital signature is required to submit your application.
        </p>
      )}
    </div>
  )
} 