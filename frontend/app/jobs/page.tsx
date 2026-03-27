'use client'

export const dynamic = 'force-dynamic'

import React, { useEffect, useState } from 'react'
import axios from 'axios'
import Link from 'next/link'
import StatusBadge from '@/components/StatusBadge'
import { AlertCircle, ArrowRight, Loader } from 'lucide-react'

interface Job {
  id: string
  video_title: string | null
  youtube_url: string
  source_language?: string
  status: string
  progress_pct?: number
  duration_seconds?: number
  metadata_?: {
    thumbnail?: string
  } | null
  created_at: string
  updated_at?: string
}

type FilterType = 'all' | 'active' | 'completed' | 'failed'

export default function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState<FilterType>('all')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [sortBy, setSortBy] = useState<'recent' | 'oldest'>('recent')

  const filters: { label: string; value: FilterType }[] = [
    { label: 'All Jobs', value: 'all' },
    { label: 'Active', value: 'active' },
    { label: 'Completed', value: 'completed' },
    { label: 'Failed', value: 'failed' },
  ]

  useEffect(() => {
    const fetchJobs = async () => {
      try {
        setLoading(true)

        const params = new URLSearchParams({
          page: page.toString(),
          page_size: '25',
        })

        if (filter !== 'all') {
          if (filter === 'active') {
            params.append('status_filter', 'downloading')
          } else {
            params.append('status_filter', filter)
          }
        }

        const response = await axios.get(`/api/jobs?${params.toString()}`)
        const data = response.data

        setJobs(Array.isArray(data.items) ? data.items : [])
        setTotalPages(data.pages || 1)
        setError('')
      } catch (err) {
        console.error('Failed to fetch jobs:', err)
        setError('Failed to load jobs')
      } finally {
        setLoading(false)
      }
    }

    fetchJobs()
  }, [filter, page])

  const filteredJobs = sortBy === 'recent' ? jobs : [...jobs].reverse()

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const getStatusColor = (status: string) => {
    if (status === 'completed') return 'bg-green-50'
    if (['downloading', 'transcribing', 'detecting_ost', 'translating', 'exporting'].includes(status)) return 'bg-blue-50'
    if (status === 'failed') return 'bg-red-50'
    return 'bg-gray-50'
  }

  const isProcessing = (status: string) => {
    return ['downloading', 'transcribing', 'detecting_ost', 'translating', 'exporting'].includes(status)
  }

  return (
    <div className="flex-1 overflow-auto">
      <div className="p-6 lg:p-8 max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Job Queue</h1>
          <p className="text-gray-600">Monitor and manage all video translation jobs</p>
        </div>

        {/* Error message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex gap-3">
            <AlertCircle className="flex-shrink-0 text-red-600 mt-0.5" size={20} />
            <div>
              <p className="text-red-800 font-medium">Error</p>
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="mb-6 card p-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex flex-wrap gap-2">
              {filters.map((f) => (
                <button
                  key={f.value}
                  onClick={() => {
                    setFilter(f.value)
                    setPage(1)
                  }}
                  className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                    filter === f.value
                      ? 'bg-accent text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'recent' | 'oldest')}
              className="input-field w-full sm:w-auto"
            >
              <option value="recent">Newest First</option>
              <option value="oldest">Oldest First</option>
            </select>
          </div>
        </div>

        {/* Jobs Table */}
        {loading ? (
          <div className="card p-8">
            <div className="flex items-center justify-center gap-3">
              <Loader className="animate-spin text-accent" size={24} />
              <p className="text-gray-600">Loading jobs...</p>
            </div>
          </div>
        ) : jobs.length === 0 ? (
          <div className="card p-12 text-center">
            <p className="text-gray-500 mb-4">No jobs found</p>
            <Link href="/submit" className="btn-primary">
              Submit a Video
            </Link>
          </div>
        ) : (
          <>
            <div className="hidden lg:block card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Video
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Language
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Progress
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Submitted
                      </th>
                      <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {filteredJobs.map((job) => (
                      <tr
                        key={job.id}
                        className={`${getStatusColor(String(job.status))} hover:bg-opacity-75 transition-colors duration-200`}
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-start gap-3">
                            {job.metadata_?.thumbnail && (
                              <img
                                src={job.metadata_.thumbnail}
                                alt={job.video_title || 'Video'}
                                className="w-12 h-12 rounded object-cover flex-shrink-0"
                                onError={(e) => {
                                  e.currentTarget.style.display = 'none'
                                }}
                              />
                            )}
                            <div className="min-w-0 flex-1">
                              <p className="font-medium text-gray-900 truncate">
                                {job.video_title || 'Untitled Video'}
                              </p>
                              <p className="text-xs text-gray-500 truncate">
                                {String(job.youtube_url || '')}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm text-gray-700">
                            {job.source_language || '-'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <StatusBadge status={String(job.status)} size="sm" />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {isProcessing(String(job.status)) && job.progress_pct ? (
                            <div className="flex items-center gap-2">
                              <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-accent transition-all duration-300"
                                  style={{ width: `${job.progress_pct}%` }}
                                />
                              </div>
                              <span className="text-xs text-gray-600">
                                {job.progress_pct}%
                              </span>
                            </div>
                          ) : (
                            <span className="text-sm text-gray-500">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm text-gray-600">
                            {formatDate(job.created_at)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <Link
                            href={`/jobs/${job.id}`}
                            className="inline-flex items-center gap-1 text-accent hover:text-accent-dark font-medium transition-colors"
                          >
                            View
                            <ArrowRight size={16} />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile view */}
            <div className="lg:hidden space-y-3">
              {filteredJobs.map((job) => (
                <Link
                  key={job.id}
                  href={`/jobs/${job.id}`}
                  className={`block card p-4 ${getStatusColor(String(job.status))} hover:shadow-md transition-all duration-200`}
                >
                  <div className="flex items-start gap-3 mb-3">
                    {job.metadata_?.thumbnail && (
                      <img
                        src={job.metadata_.thumbnail}
                        alt={job.video_title || 'Video'}
                        className="w-16 h-16 rounded object-cover flex-shrink-0"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none'
                        }}
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 truncate">
                        {job.video_title || 'Untitled Video'}
                      </p>
                      <p className="text-xs text-gray-500 truncate">
                        {String(job.youtube_url || '')}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-600">
                        {job.source_language || '-'}
                      </span>
                      <StatusBadge status={String(job.status)} size="sm" />
                    </div>

                    {isProcessing(String(job.status)) && job.progress_pct && (
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-accent transition-all duration-300"
                            style={{ width: `${job.progress_pct}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-600">
                          {job.progress_pct}%
                        </span>
                      </div>
                    )}

                    <p className="text-xs text-gray-500">
                      {formatDate(job.created_at)}
                    </p>
                  </div>
                </Link>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-6 flex items-center justify-center gap-2">
                <button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                  className="btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>

                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(totalPages, 10) }, (_, i) => i + 1).map((p) => (
                    <button
                      key={p}
                      onClick={() => setPage(p)}
                      className={`w-10 h-10 rounded-lg font-medium transition-all duration-200 ${
                        page === p
                          ? 'bg-accent text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>

                <button
                  onClick={() => setPage(Math.min(totalPages, page + 1))}
                  disabled={page === totalPages}
                  className="btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
