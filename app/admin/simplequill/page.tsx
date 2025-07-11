'use client'

import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'

// Dinamički importujemo ReactQuill da bismo izbegli SSR probleme
const ReactQuill = dynamic(() => import('react-quill'), {
  ssr: false,
  loading: () => <div className="bg-gray-100 p-6">Učitavanje editora...</div>
})

// Importujemo Quill stilove
import 'react-quill/dist/quill.snow.css'

export default function SimpleQuill() {
  const [content, setContent] = useState('')
  const [isMounted, setIsMounted] = useState(false)
  
  // Postavljamo isMounted na true samo na klijentskoj strani
  useEffect(() => {
    setIsMounted(true)
  }, [])
  
  // Handler za promenu sadržaja
  const handleContentChange = (newContent: string) => {
    console.log('Content changed:', newContent)
    setContent(newContent)
  }
  
  // Konfiguracija toolbar-a
  const modules = {
    toolbar: [
      [{ 'header': [1, 2, 3, false] }],
      ['bold', 'italic', 'underline', 'strike'],
      [{ 'list': 'ordered'}, { 'list': 'bullet' }],
      ['link']
    ]
  }
  
  return (
    <div className="p-10 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-8 text-white">Jednostavan Rich Text Editor</h1>
      
      <div className="bg-white p-6 rounded shadow-md">
        {/* Editor se prikazuje samo kada je komponenta montirana na klijentskoj strani */}
        {isMounted ? (
          <div>
            <ReactQuill
              theme="snow"
              value={content}
              onChange={handleContentChange}
              modules={modules}
              placeholder="Počnite da kucate..."
            />
            <div className="mt-6">
              <h3 className="text-lg font-semibold">HTML Output:</h3>
              <div className="mt-2 p-4 bg-gray-100 rounded overflow-auto max-h-40">
                {content || <span className="text-gray-400">No content yet...</span>}
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-gray-100 p-6 text-center">
            Učitavanje editora...
          </div>
        )}
      </div>
    </div>
  )
}
