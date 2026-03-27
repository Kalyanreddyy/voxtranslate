import React from 'react'
import Link from 'next/link'
import StatusBadge from './StatusBadge'
import { Clock, Globe } from 'lucide-react'

interface JobCardProps {
  id: string
  title: string
  language?: string
  status: string
  progress?: number
  duration?: string
  submittedAt: string
  thumbnail?: string
}

export default function JobCard({
  id,
  title,
  language,
  status,
  progress = 0,
  duration,
  submittedAt,
  thumbnail,
}: JobCardProps) {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`

    return date.toLocaleDateString()
  }

  return (
    <Link href={`/jobs/${id}`}>
      <div className="card-hover p-4 cursor-pointer">
        <div className="flex gap-4">
          {/* Thumbnail */}
          {thumbnail && (
            <div className="hidden sm:block flex-shrink-0 w-20 h-20 bg-gray-200 rounded-lg overflow-hidden">
              <img
                src={thumbnail}
                alt={title}
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.currentTarget.style.display = 'none'
                }}
              />
            </div>
          )}

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 mb-2">
              <h3 className="font-semibold text-gray-900 truncate-lines-2">
                {title}
              </h3>
              <StatusBadge status={status} size="sm" />
            </div>

            {/* Metadata */}
            <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600 mb-3">
              {language && (
                <div className="flex items-center gap-1">
                  <Globe size={14} />
                  <span>{language}</span>
                </div>
              )}
              {duration && (
                <div className="flex items-center gap-1">
                  <Clock size={14} />
                  <span>{duration}</span>
                </div>
              )}
              <span className="text-xs text-gray-500">
                {formatDate(submittedAt)}
              </span>
            </div>

            {/* Progress bar */}
            {['downloading', 'transcribing', 'detecting_ost', 'translating', 'exporting', 'processing'].includes(status) && (
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-accent h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </Link>
  )
}
