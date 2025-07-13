import './globals.css'
import type { Metadata } from 'next'
import AuthProviderClient from './components/AuthProviderClient'
import DatePickerInitializer from './components/DatePickerInitializer'
import ScrollToTop from './components/ScrollToTop'

export const metadata: Metadata = {
  title: 'Advertising Platform | Senergy Capital',
  description: 'Advertising platform for creators',
  icons: {
    icon: 'https://fbmdbvijfufsjpsuorxi.supabase.co/storage/v1/object/public/company-logos/logos/Vector.svg',
    shortcut: 'https://fbmdbvijfufsjpsuorxi.supabase.co/storage/v1/object/public/company-logos/logos/Vector.svg',
    apple: 'https://fbmdbvijfufsjpsuorxi.supabase.co/storage/v1/object/public/company-logos/logos/Vector.svg',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <ScrollToTop />
        <AuthProviderClient>
          {children}
        </AuthProviderClient>
        <DatePickerInitializer />
      </body>
    </html>
  )
} 