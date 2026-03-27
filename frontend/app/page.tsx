'use client'

export const dynamic = 'force-dynamic'

import React, { useEffect, useState } from 'react'
import axios from 'axios'
import StatsCard from '@/components/StatsCard'
import JobCard from '@/components/JobCard'
import SubmitForm from '@/components/SubmitForm'
import {
  Activity,
  BarChart3,
  Calendar,
  Clock,
  ArrowRight,
  Loader,
  AlertCircle,
} from 'lucide-react'
import Link from 'next/link'

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
}

interface Stats {
  active_jobs: number
  today_count: number
  week_count: number
  total_count: number
  queued_jobs: number
  failed_jobs: number
  avg_time_seconds: number | null
  cost_today: number
  cost_week: number
  cost_total: number
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [jobs, setJobs] = useState<Job[]>([])
  const [statsLoading, setStatsLoading] = useState(true)
  const [jobsLoading, setJobsLoading] = useState(true)
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)

  useEffect(() => {
    const fetchData = async () => {
      try {
        setStatsLoading(true)
        setJobsLoading(true)

        const [statsResponse, jobsResponse] = await Promise.allSettled([
          axios.get('/api/stats').catch(e => ({ data: null, error: e })),
          axios.get('/api/jobs?page=1&page_size=10').catch(e => ({ data: null, error: e })),
        ])

        if (statsResponse.status === 'fulfilled' && statsResponse.value?.data && !('error' in statsResponse.value)) {
          const s = statsResponse.value.data
          // Ensure all stats values are primitives (not objects)
          setStats({
            active_jobs: Number(s.active_jobs) || 0,
            today_count: Number(s.today_count) || 0,
            week_count: Number(s.week_count) || 0,
            total_count: Number(s.total_count) || 0,
            queued_jobs: Number(s.queued_jobs) || 0,
            failed_jobs: Number(s.failed_jobs) || 0,
            avg_time_seconds: s.avg_time_seconds != null ? Number(s.avg_time_seconds) : null,
            cost_today: Number(s.cost_today) || 0,
            cost_week: Number(s.cost_week) || 0,
            cost_total: Number(s.cost_total) || 0,
          })
        }
        if (jobsResponse.status === 'fulfilled' && jobsResponse.value?.data && !('error' in jobsResponse.value)) {
          const data = jobsResponse.value.data
          const items = Array.isArray(data.items) ? data.items : []
          // Ensure job fields are primitives
          setJobs(items.map((j: any) => ({
            id: String(j.id || ''),
            video_title: j.video_title ? String(j.video_title) : null,
            youtube_url: String(j.youtube_url || ''),
            source_language: j.source_language ? String(j.source_language) : undefined,
            status: String(j.status || 'queued'),
            progress_pct: j.progress_pct != null ? Number(j.progress_pct) : undefined,
            duration_seconds: j.duration_seconds != null ? Number(j.duration_seconds) : undefined,
            metadata_: j.metadata_ || null,
            created_at: String(j.created_at || ''),
          })))
        }
        setError('')
      } catch (err) {
        console.error('Failed to fetch data:', err)
        setError('Cannot connect to backend. Run: docker compose up -d')
      } finally {
        setStatsLoading(false)
        setJobsLoading(false)
      }
    }

    fetchData()

    // Refresh data every 10 seconds
    const interval = setInterval(fetchData, 10000)
    return () => clearInterval(interval)
  }, [])

  const formatTime = (seconds: number) => {
    if (seconds < 60) return `${Math.round(seconds)}s`
    if (seconds < 3600) return `${Math.round(seconds / 60)}m`
    return `${Math.round(seconds / 3600)}h`
  }

  return (
    <div className="flex-1 overflow-auto">
      <div className="p-6 lg:p-8 max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Dashboard</h1>
          <p className="text-gray-600">Monitor your video translation pipeline</p>
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatsCard
            icon={Activity}
            label="Active Jobs"
            value={stats?.active_jobs ?? 0}
            color="blue"
            loading={statsLoading}
          />
          <StatsCard
            icon={Calendar}
            label="Today's Count"
            value={stats?.today_count ?? 0}
            color="green"
            loading={statsLoading}
          />
          <StatsCard
            icon={BarChart3}
            label="Weekly Count"
            value={stats?.week_count ?? 0}
            color="purple"
            loading={statsLoading}
          />
          <StatsCard
            icon={Clock}
            label="Avg Processing"
            value={
              stats?.avg_time_seconds
                ? formatTime(stats.avg_time_seconds)
                : '-'
            }
            color="orange"
            loading={statsLoading}
          />
        </div>

        {/* Quick Submit Section */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-gray-900">Quick Submit</h2>
            <Link
              href="/submit"
              className="flex items-center gap-2 text-accent hover:text-accent-dark font-medium transition-colors"
            >
              Full Form
              <ArrowRight size={18} />
            </Link>
          </div>

          {showForm ? (
            <SubmitForm onSuccess={() => setShowForm(false)} />
          ) : (
            <div className="card p-8 text-center">
              <div className="max-w-md mx-auto">
                <p className="text-gray-600 mb-4">
                  Quickly submit a YouTube URL for translation processing
                </p>
                <button
                  onClick={() => setShowForm(true)}
                  className="btn-primary"
                >
                  Open Submission Form
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Recent Jobs */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-gray-900">Recent Jobs</h2>
            <Link
              href="/jobs"
              className="flex items-center gap-2 text-accent hover:text-accent-dark font-medium transition-colors"
            >
              View All
              <ArrowRight size={18} />
            </Link>
          </div>

          {jobsLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="card p-4 animate-pulse">
                  <div className="h-24 bg-gray-200 rounded" />
                </div>
              ))}
            </div>
          ) : jobs.length === 0 ? (
            <div className="card p-8 text-center">
              <p className="text-gray-500 mb-4">No jobs yet</p>
              <Link href="/submit" className="btn-primary">
                Submit Your First Video
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {jobs.map((job) => (
                <JobCard
                  key={job.id}
                  id={job.id}
                  title={job.video_title || 'Untitled Video'}
                  language={job.source_language}
                  status={job.status}
                  progress={job.progress_pct}
                  duration={job.duration_seconds ? `${Math.round(job.duration_seconds / 60)}m` : undefined}
                  submittedAt={job.created_at}
                  thumbnail={job.metadata_?.thumbnail}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
