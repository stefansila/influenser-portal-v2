'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

export default function ScrollToTop() {
  const pathname = usePathname()

  useEffect(() => {
    // Scroll to top when pathname changes with smooth behavior
    const scrollToTop = () => {
      window.scrollTo({
        top: 0,
        left: 0,
        behavior: 'smooth'
      })
    }

    // Immediate scroll
    scrollToTop()
    
    // Delayed scroll as fallback for slow-loading content
    const timeoutId = setTimeout(scrollToTop, 100)
    
    return () => clearTimeout(timeoutId)
  }, [pathname])

  return null
} 