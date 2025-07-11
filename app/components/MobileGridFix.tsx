import React, { useEffect } from 'react';

/**
 * Komponenta koja pomaže u popravljanju grid layouta na mobilnim uređajima
 * Ova komponenta treba da se importuje u _app.tsx ili layout.tsx
 */
export default function MobileGridFix() {
  useEffect(() => {
    // Skripta koja će se pokrenuti samo na client-side
    const fixMobileGrids = () => {
      if (typeof window !== 'undefined') {
        // Proveri da li je mobilni uređaj
        const isMobile = window.innerWidth <= 480;
        
        if (isMobile) {
          // Pronađi sve grid-cols-3 elemente i dodaj klasu za mobilni prikaz
          const gridElements = document.querySelectorAll('.grid-cols-3');
          gridElements.forEach(element => {
            if (element.classList) {
              // Ako već ima mobile-fix klasu, ne dodavaj je opet
              if (!element.classList.contains('mobile-grid-fix')) {
                element.classList.add('mobile-grid-fix');
              }
            }
          });
        }
      }
    };

    // Pokreni odmah nakon renderovanja
    fixMobileGrids();
    
    // Pokreni i pri promeni veličine prozora
    window.addEventListener('resize', fixMobileGrids);
    
    // Cleanup
    return () => {
      window.removeEventListener('resize', fixMobileGrids);
    };
  }, []);

  return null; // Ova komponenta ne renderuje ništa
} 