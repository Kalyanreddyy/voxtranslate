'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import {
  LayoutDashboard,
  Upload,
  ListTodo,
  Settings,
  Menu,
  X,
  CheckSquare,
  HelpCircle,
} from 'lucide-react'

const adminNavItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/submit', label: 'Submit Job', icon: Upload },
  { href: '/jobs', label: 'Job Queue', icon: ListTodo },
  { href: '/settings', label: 'Settings', icon: Settings },
]

const linguistNavItems = [
  { href: '/queue', label: 'My Queue', icon: ListTodo },
  { href: '/jobs?status=completed', label: 'Completed', icon: CheckSquare },
  { href: '/settings', label: 'Settings', icon: HelpCircle },
]

export default function Sidebar() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isOpen, setIsOpen] = useState(false)
  const [role, setRole] = useState<'admin' | 'linguist'>('admin')
  const [userName, setUserName] = useState('User')

  useEffect(() => {
    // Check URL param for role override, otherwise use localStorage
    const urlRole = searchParams.get('role') as 'admin' | 'linguist' | null
    if (urlRole) {
      setRole(urlRole)
      localStorage.setItem('userRole', urlRole)
    } else {
      const storedRole = localStorage.getItem('userRole') as 'admin' | 'linguist' | null
      if (storedRole) {
        setRole(storedRole)
      }
    }

    const storedName = localStorage.getItem('userName')
    if (storedName) {
      setUserName(storedName)
    }
  }, [searchParams])

  const navItems = role === 'linguist' ? linguistNavItems : adminNavItems

  const isActive = (href: string) => {
    if (href === '/') {
      return pathname === '/'
    }
    return pathname.startsWith(href)
  }

  return (
    <>
      {/* Mobile menu button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-4 right-4 z-40 lg:hidden p-3 bg-accent text-white rounded-full shadow-lg hover:bg-accent-dark transition-colors"
        aria-label="Toggle menu"
      >
        {isOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      {/* Overlay for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed left-0 top-0 bottom-0 w-64 bg-sidebar text-white flex flex-col transition-transform duration-300 z-40 lg:relative lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Logo */}
        <div className="p-6 border-b border-white/10">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-10 h-10 bg-accent rounded-lg flex items-center justify-center font-bold text-lg">
              VT
            </div>
            <div>
              <p className="font-bold text-lg">VoxTranslate</p>
              <p className="text-xs text-gray-400">Translation Pipeline</p>
            </div>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-2">
          {navItems.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setIsOpen(false)}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-all duration-200 ${
                isActive(href)
                  ? 'bg-accent text-white'
                  : 'text-gray-300 hover:text-white hover:bg-white/10'
              }`}
            >
              <Icon size={20} />
              <span>{label}</span>
            </Link>
          ))}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-white/10 space-y-3">
          <div className="text-xs text-gray-400 space-y-1">
            <p>Status: <span className="text-green-400">Connected</span></p>
            <p>API: <span className="text-gray-300">localhost:8000</span></p>
          </div>

          {/* User badge */}
          <div className="bg-white/10 rounded-lg p-3 text-sm">
            <p className="text-gray-300 font-medium">{userName}</p>
            <p className="text-gray-400 text-xs capitalize">{role}</p>
          </div>
        </div>
      </aside>
    </>
  )
}
