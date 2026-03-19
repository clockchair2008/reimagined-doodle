import type { Metadata } from 'next'
import './globals.css'
import SecurityGuard from './components/SecurityGuard'
import AntiTamper from './components/AntiTamper'
import DevToolsBlocker from './components/DevToolsBlocker'
import AuthGuard from './components/AuthGuard'

export const metadata: Metadata = {
  title: 'ZATCA E-Invoicing System',
  description: 'ZATCA Phase 1 E-Invoicing Platform',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <DevToolsBlocker />
        <SecurityGuard />
        <AntiTamper />
        <AuthGuard>
          {children}
        </AuthGuard>
      </body>
    </html>
  )
}
