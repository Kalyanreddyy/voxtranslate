'use client'

export const dynamic = 'force-dynamic'

import React, { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import axios from 'axios'
import Link from 'next/link'
import StatusBadge from '@/components/StatusBadge'
import StatsCard from '@/components/StatsCard'
import { reviewApi } from '@/lib/api'
import {
  Loader,
  AlertCircle,
  ArrowLeft,
  Edit2,
  TrendingUp,
  CheckCircle2,
  Clock,
} from 'lucide-react'

interface QueueJob {
  id: string
  title: string
  status: string
  language?: string
  duration?: string
  metadata?: {
    thumbnail?: string
  }
  created_at: string
}

type FilterType = 'all' | 'transcription' | 'translation'

function QueuePageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [userName, setUserName] = useState('')
  const [jobs, setJobs] = useState<QueueJob[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState<FilterType>('all')
  const [stats, setStats] = useState({
    pendingReview: 0,
    completedToday: 0,
    avgReviewTime: '0m',
  })

  useEffect(() => {
    const storedName = localStorage.getItem('userName')
    if (storedName) {
      setUserName(storedName)
    }
  }, [])

  useEffect(() => {
    const fetchQueue = async () => {
      if (!userName) return

      try {
        setLoading(true)
        const queue = await reviewApi.getUserQueue(userName)
        setJobs(queue.jobs || [])

        // Calculate stats
        const pending = (queue.jobs || []).filter((j: QueueJob) =>
          j.status.includes('review')
        ).length
        setStats({
          pendingReview: pending,
          completedToday: 0,
          avgReviewTime: '15m',
        })

        setError('')
      } catch (err) {
        console.error('Failed to fetch queue:', err)
        setError('Failed to load your queue')
      } finally {
        setLoading(false)
      }
    }

    fetchQueue()
  }, [userName])

  const filteredJobs = jobs.filter((job) => {
    if (filter === 'all') return true
    if (filter === 'transcription') return job.status === 'awaiting_transcription_review'
    if (filter === 'translation') return job.status === 'awaiting_translation_review'
    return true
  })

  const getReviewLink = (job: QueueJob) => {
    if (job.status === 'awaiting_transcription_review') {
      return `/review/transcription/${job.id}`
    }
    if (job.status === 'awaiting_translation_review') {
      return `/review/translation/${job.id}`
    }
    return `/jobs/${job.id}`
  }

  if (loading) {
    return (
      <div className="flex-1 overflow-auto">
        <div className="p-6 lg:p-8 max-w-5xl mx-auto">
          <div className="flex items-center justify-center h-96">
            <div className="text-center">
              <Loader className="animate-spin text-accent mx-auto mb-4" size={32} />
              <p className="text-gray-600">Loading your queue...</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-auto">
      <div className="p-6 lg:p-8 max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">My Queue</h1>
          <p className="text-gray-600">Review and edit assigned translation tasks</p>
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

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <StatsCard
            label="Pending Review"
            value={stats.pendingReview.toString()}
            icon={Clock}
            color="orange"
            trend={stats.pendingReview > 0 ? 'up' : 'neutral'}
            trendValue={stats.pendingReview > 0 ? `${stats.pendingReview} waiting` : 'All caught up!'}
          />
          <StatsCard
            label="Completed Today"
            value={stats.completedToday.toString()}
            icon={CheckCircle2}
            color="green"
            trend="neutral"
            trendValue="Great progress"
          />
          <StatsCard
            label="Avg Review Time"
            value={stats.avgReviewTime}
            icon={TrendingUp}
            color="blue"
            trend="neutral"
            trendValue="Per segment"
          />
        </div>

        {/* Filter Tabs */}
        <div className="mb-6 border-b border-gray-200 flex gap-0">
          {(['all', 'transcription', 'translation'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`px-4 py-3 font-medium transition-colors ${
                filter === tab
                  ? 'border-b-2 border-accent text-accent'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {tab === 'all' && 'All'}
              {tab === 'transcription' && 'Transcription'}
              {tab === 'translation' && 'Translation'}
            </button>
          ))}
        </div>

        {/* Jobs List */}
        {filteredJobs.length === 0 ? (
          <div className="card p-12 text-center">
            <CheckCircle2 className="mx-auto text-green-600 mb-4" size={48} />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              {jobs.length === 0 ? 'No Assigned Jobs' : 'No Jobs Match Filter'}
            </h3>
            <p className="text-gray-600 mb-6">
              {jobs.length === 0
                ? 'You have no jobs assigned for review yet'
                : 'Try a different filter to see more jobs'}
            </p>
            <Link href="/jobs" className="btn-primary">
              Browse All Jobs
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredJobs.map((job) => (
              <div key={job.id} className="card p-4 hover:shadow-md transition-shadow">
                {/* Thumbnail */}
                {job.metadata?.thumbnail && (
                  <div className="w-full h-32 bg-gray-200 rounded-lg overflow-hidden mb-4">
                    <img
                      src={job.metadata.thumbnail}
                      alt={job.title}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none'
                      }}
                    />
                  </div>
                )}

                {/* Content */}
                <h3 className="font-bold text-gray-900 mb-2 truncate-lines-2">
                  {job.title}
                </h3>

                {/* Meta */}
                <div className="flex gap-2 mb-4 text-sm text-gray-600">
                  {job.language && (
                    <span className="flex items-center gap-1">
                      <span>🌐</span>
                      {job.language}
                    </span>
                  )}
                  {job.duration && (
                    <span className="flex items-center gap-1">
                      <Clock size={14} />
                      {job.duration}
                    </span>
                  )}
                </div>

                {/* Status Badge */}
                <div className="mb-4">
                  <StatusBadge status={job.status as any} size="sm" />
                </div>

                {/* Review Button */}
                <Link
                  href={getReviewLink(job)}
                  className="btn-primary w-full flex items-center justify-center gap-2"
                >
                  <Edit2 size={18} />
                  Review
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default function QueuePage() {
  return (
    <Suspense fallback={
      <div className="flex-1 overflow-auto">
        <div className="p-6 lg:p-8 max-w-5xl mx-auto">
          <div className="flex items-center justify-center h-96">
            <div className="text-center">
              <Loader className="animate-spin text-accent mx-auto mb-4" size={32} />
              <p className="text-gray-600">Loading your queue...</p>
            </div>
          </div>
        </div>
      </div>
    }>
      <QueuePageContent />
    </Suspense>
  )
}
