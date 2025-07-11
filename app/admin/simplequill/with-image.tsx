'use client'

import { useState, useEffect, useCallback } from 'react'
import dynamic from 'next/dynamic'

// Dinamički importujemo ReactQuill da bismo izbegli SSR probleme
const ReactQuill = dynamic(() => import('react-quill'), {
  ssr: false,
  loading: () => <div className="bg-gray-100 p-6">Učitavanje editora...</div>
})

// Importujemo Quill stilove
import 'react-quill/dist/quill.snow.css'

export default function QuillWithImage() {
  const [content, setContent] = useState('')
  const [isMounted, setIsMounted] = useState(false)
  const [isUploadingImage, setIsUploadingImage] = useState(false)
  
  // Postavljamo isMounted na true samo na klijentskoj strani
  useEffect(() => {
    setIsMounted(true)
  }, [])
  
  // Handler za promenu sadržaja
  const handleContentChange = (newContent: string) => {
    console.log('Content changed:', newContent)
    setContent(newContent)
  }
  
  // Handler za dodavanje slika
  const imageHandler = useCallback(() => {
    // Ako je već u toku upload, ne dozvoljavamo novi
    if (isUploadingImage) return
    
    const input = document.createElement('input')
    input.setAttribute('type', 'file')
    input.setAttribute('accept', 'image/*')
    input.click()
    
    input.onchange = async () => {
      if (!input.files || !input.files[0]) return
      
      try {
        setIsUploadingImage(true)
        
        // Simuliramo upload (samo za demo)
        await new Promise(resolve => setTimeout(resolve, 1500))
        
        // Kreiranje lokalnog URL-a za sliku (u pravoj aplikaciji, ovo bi bio URL sa servera)
        const imageUrl = URL.createObjectURL(input.files[0])
        
        // Dodajemo sliku u sadržaj koristeći HTML manipulaciju direktno
        // Ovo izbegava potrebu za direktnim DOM pristupom Quill editoru
        const imageTag = `<img src="${imageUrl}" alt="Uploaded image" style="max-width: 100%;" />`
        
        // Dodajemo sliku na kraj sadržaja
        const newContent = content + imageTag
        setContent(newContent)
      } catch (error) {
        console.error('Error uploading image:', error)
      } finally {
        setIsUploadingImage(false)
      }
    }
  }, [content, isUploadingImage])
  
  // Konfiguracija toolbar-a
  const modules = {
    toolbar: {
      container: [
        [{ 'header': [1, 2, 3, false] }],
        ['bold', 'italic', 'underline', 'strike'],
        [{ 'list': 'ordered'}, { 'list': 'bullet' }],
        ['link', 'image'],
      ],
      handlers: {
        image: imageHandler
      }
    }
  }
  
  return (
    <div className="p-10 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-8 text-white">Rich Text Editor sa slikama</h1>
      
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
            
            {isUploadingImage && (
              <div className="mt-2 p-2 bg-blue-50 text-blue-600 rounded">
                Učitavanje slike...
              </div>
            )}
            
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