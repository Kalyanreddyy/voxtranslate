import type { Metadata } from 'next'
import { Suspense } from 'react'
import './globals.css'
import Sidebar from './components/Sidebar'

export const metadata: Metadata = {
  title: 'VoxTranslate - Video Translation Pipeline',
  description: 'Internal team webapp for VoxTranslate video translation pipeline',
  icons: {
    icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect fill="%231a1a2e" width="100" height="100"/><text x="50" y="70" font-size="60" fill="white" text-anchor="middle" font-weight="bold">VT</text></svg>',
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
        <div className="flex h-screen bg-gray-50">
          {/* Sidebar */}
          <Suspense fallback={<div className="w-64 bg-sidebar" />}>
            <Sidebar />
          </Suspense>

          {/* Main content */}
          <main className="flex-1 overflow-auto flex flex-col">
            <div className="flex-1">{children}</div>
          </main>
        </div>
      </body>
    </html>
  )
}
