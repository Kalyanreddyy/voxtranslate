'use client'

import React from 'react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  // Safely extract error message - handle objects, strings, and unknown types
  const getErrorMessage = (): string => {
    if (!error) return 'An unexpected error occurred.'
    if (typeof error.message === 'string') return error.message
    if (typeof error.message === 'object') {
      try {
        return JSON.stringify(error.message)
      } catch {
        return 'An unexpected error occurred.'
      }
    }
    return String(error.message || 'An unexpected error occurred.')
  }

  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="text-center max-w-md">
        <div className="text-6xl mb-4">&#x26A0;&#xFE0F;</div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Something went wrong</h2>
        <p className="text-gray-600 mb-6">
          The dashboard could not load. This usually means the backend API returned an unexpected response.
        </p>
        <button
          onClick={reset}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Try Again
        </button>
      </div>
    </div>
  )
}
