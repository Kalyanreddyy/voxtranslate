'use client'

export const dynamic = 'force-dynamic'

import React from 'react'
import SubmitForm from '@/components/SubmitForm'
import { useRouter } from 'next/navigation'

export default function SubmitPage() {
  const router = useRouter()

  const handleSuccess = (jobIds: string[]) => {
    // Redirect to the first job's detail page after 2 seconds
    setTimeout(() => {
      if (jobIds.length === 1) {
        router.push(`/jobs/${jobIds[0]}`)
      } else {
        router.push('/jobs')
      }
    }, 2000)
  }

  return (
    <div className="flex-1 overflow-auto">
      <div className="p-6 lg:p-8 max-w-2xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Submit Videos for Translation
          </h1>
          <p className="text-gray-600">
            Upload YouTube videos for processing through the VoxTranslate
            pipeline
          </p>
        </div>

        {/* Submit Form */}
        <SubmitForm onSuccess={handleSuccess} />

        {/* Info section */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="card p-4">
            <h3 className="font-semibold text-gray-900 mb-2">Supported URLs</h3>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• YouTube videos</li>
              <li>• YouTube playlists</li>
              <li>• YouTube channels</li>
              <li>• YouTube Shorts</li>
            </ul>
          </div>

          <div className="card p-4">
            <h3 className="font-semibold text-gray-900 mb-2">
              Processing Details
            </h3>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• Automatic language detection</li>
              <li>• Background music separation</li>
              <li>• High-quality translation</li>
              <li>• DOCX export format</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
