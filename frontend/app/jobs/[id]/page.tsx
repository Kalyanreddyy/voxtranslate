'use client'

export const dynamic = 'force-dynamic'

import React, { useEffect, useState } from 'react'
import axios from 'axios'
import { useParams, useRouter } from 'next/navigation'
import PipelineProgress from '@/components/PipelineProgress'
import PipelineProgressV2 from '@/components/PipelineProgressV2'
import StatusBadge from '@/components/StatusBadge'
import ChunkManager from '@/components/ChunkManager'
import {
  Download,
  Loader,
  AlertCircle,
  ArrowLeft,
  Copy,
  Check,
  RotateCcw,
  Globe,
  Clock,
  User,
  FileText,
  Music,
  Edit2,
  Scissors,
} from 'lucide-react'
import Link from 'next/link'
import { reviewApi } from '@/lib/api'

interface TimeRange {
  start: string
  end: string
}

interface JobDetail {
  id: string
  video_title: string | null
  youtube_url: string
  source_language?: string
  status: string
  progress_pct?: number
  duration_seconds?: number
  current_stage?: string | null
  time_ranges?: TimeRange[] | null
  is_parent?: string | null
  parent_job_id?: string | null
  chunk_index?: number | null
  chunk_count?: number | null
  chunks_completed?: number | null
  metadata_?: {
    thumbnail?: string
    channel?: string
    views?: number
  } | null
  transcription?: any | null
  translation?: any | null
  ost_detection?: any | null
  output_path?: string | null
  error_message?: string | null
  assigned_to?: string | null
  submitted_by?: string | null
  cost_usd?: number
  created_at: string
  updated_at?: string | null
  completed_at?: string | null
  submitted_at?: string | null
  transcription_reviewed_at?: string | null
  translation_reviewed_at?: string | null
  reviewer_notes?: string | null
}

export default function JobDetailPage() {
  const params = useParams()
  const router = useRouter()
  const jobId = params.id as string

  const [job, setJob] = useState<JobDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [retrying, setRetrying] = useState(false)
  const [showTranslation, setShowTranslation] = useState(false)
  const [users, setUsers] = useState<any[]>([])
  const [assigningUser, setAssigningUser] = useState<string | null>(null)
  const [showAssignDropdown, setShowAssignDropdown] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    const fetchJob = async () => {
      try {
        setLoading(true)
        const response = await axios.get(`/api/jobs/${jobId}`)
        setJob(response.data)
        setError('')
      } catch (err) {
        console.error('Failed to fetch job:', err)
        setError('Failed to load job details')
      } finally {
        setLoading(false)
      }
    }

    fetchJob()

    // Fetch users for assignment and check if admin
    const fetchUsers = async () => {
      try {
        const userList = await reviewApi.getUsers()
        setUsers(userList)
        const isAdminUser = localStorage.getItem('userRole') === 'admin'
        setIsAdmin(isAdminUser)
      } catch (err) {
        console.error('Failed to fetch users:', err)
      }
    }
    fetchUsers()
  }, [jobId])

  // Set up SSE for real-time updates if job is processing
  useEffect(() => {
    if (!job) return
    const processingStatuses = ['queued', 'downloading', 'transcribing', 'detecting_ost', 'translating', 'exporting']
    if (!processingStatuses.includes(String(job.status))) return

    const eventSource = new EventSource(`/api/jobs/${jobId}/events`)

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        setJob((prev) => (prev ? { ...prev, ...data } : null))
      } catch (e) {
        console.error('Failed to parse SSE message:', e)
      }
    }

    eventSource.onerror = () => {
      eventSource.close()
    }

    return () => eventSource.close()
  }, [jobId, job?.status])

  const handleCopyId = () => {
    navigator.clipboard.writeText(jobId)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleRetry = async () => {
    try {
      setRetrying(true)
      await axios.post(`/api/jobs/${jobId}/retry`)
      window.location.reload()
    } catch (err) {
      console.error('Failed to retry job:', err)
      setError('Failed to retry job')
    } finally {
      setRetrying(false)
    }
  }

  const handleDownload = async () => {
    try {
      const response = await axios.get(`/api/jobs/${jobId}/download`, {
        responseType: 'blob',
      })

      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `translation-${jobId}.docx`)
      document.body.appendChild(link)
      link.click()
      link.parentNode?.removeChild(link)
      window.URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Failed to download:', err)
      setError('Failed to download translation')
    }
  }

  const handleAssignJob = async (username: string) => {
    try {
      setAssigningUser(username)
      await reviewApi.assignJob(jobId, username)
      setShowAssignDropdown(false)
      setError('')
    } catch (err) {
      console.error('Failed to assign job:', err)
      setError('Failed to assign job to linguist')
    } finally {
      setAssigningUser(null)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  }

  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`
    if (seconds < 3600) return `${Math.round(seconds / 60)}m`
    return `${Math.round(seconds / 3600)}h ${Math.round((seconds % 3600) / 60)}m`
  }

  // Derive pipeline state from current_stage
  const stageOrder = ['downloading', 'transcribing', 'detecting_ost', 'translating', 'exporting', 'completed']
  const currentStageIndex = job?.current_stage ? stageOrder.indexOf(job.current_stage) : -1
  const completedStages = stageOrder
    .slice(0, Math.max(0, currentStageIndex))
    .map((_, i) => i)
  const failedStage = String(job?.status) === 'failed' ? currentStageIndex : undefined

  if (loading) {
    return (
      <div className="flex-1 overflow-auto">
        <div className="p-6 lg:p-8 max-w-4xl">
          <div className="flex items-center justify-center h-96">
            <div className="text-center">
              <Loader className="animate-spin text-accent mx-auto mb-4" size={32} />
              <p className="text-gray-600">Loading job details...</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!job) {
    return (
      <div className="flex-1 overflow-auto">
        <div className="p-6 lg:p-8 max-w-4xl">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-accent hover:text-accent-dark font-medium mb-6"
          >
            <ArrowLeft size={20} />
            Back
          </button>

          <div className="card p-8 text-center">
            <AlertCircle className="mx-auto text-red-500 mb-4" size={48} />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Job Not Found
            </h2>
            <p className="text-gray-600 mb-6">
              The requested job does not exist or has been deleted.
            </p>
            <Link href="/jobs" className="btn-primary">
              View All Jobs
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const statusStr = String(job.status)
  const isParent = job.is_parent === 'Y'
  const isChunk = !!job.parent_job_id

  return (
    <div className="flex-1 overflow-auto">
      <div className="p-6 lg:p-8 max-w-4xl">
        {/* Back button */}
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-accent hover:text-accent-dark font-medium mb-6"
        >
          <ArrowLeft size={20} />
          Back
        </button>

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

        {/* Header section */}
        <div className="card p-6 mb-6">
          <div className="flex flex-col md:flex-row gap-6">
            {/* Thumbnail */}
            {job.metadata_?.thumbnail && (
              <div className="flex-shrink-0 w-full md:w-48 h-32 bg-gray-200 rounded-lg overflow-hidden">
                <img
                  src={job.metadata_.thumbnail}
                  alt={job.video_title || 'Video'}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none'
                  }}
                />
              </div>
            )}

            {/* Info */}
            <div className="flex-1">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <h1 className="text-3xl font-bold text-gray-900 mb-2">
                    {job.video_title || 'Untitled Video'}
                  </h1>
                  <p className="text-gray-600 break-all">{String(job.youtube_url || '')}</p>
                </div>
                <StatusBadge status={statusStr} size="lg" />
              </div>

              {/* Chunk info */}
              {isChunk && job.chunk_index != null && job.chunk_count != null && (
                <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-900 font-medium">
                    Chunk {job.chunk_index + 1} of {job.chunk_count}
                  </p>
                  {job.parent_job_id && (
                    <Link
                      href={`/jobs/${job.parent_job_id}`}
                      className="text-sm text-blue-600 hover:text-blue-800 mt-1 inline-block"
                    >
                      Back to parent job
                    </Link>
                  )}
                </div>
              )}

              {/* Metadata grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-xs text-gray-500 mb-1">Job ID</p>
                  <p className="font-mono text-sm text-gray-900 flex items-center gap-2">
                    {jobId.slice(0, 8)}
                    <button
                      onClick={handleCopyId}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      {copied ? <Check size={14} /> : <Copy size={14} />}
                    </button>
                  </p>
                </div>

                {job.source_language && (
                  <div>
                    <p className="text-xs text-gray-500 mb-1 flex items-center gap-1">
                      <Globe size={12} />
                      Language
                    </p>
                    <p className="font-medium text-sm text-gray-900">
                      {job.source_language}
                    </p>
                  </div>
                )}

                {job.duration_seconds && (
                  <div>
                    <p className="text-xs text-gray-500 mb-1 flex items-center gap-1">
                      <Clock size={12} />
                      Duration
                    </p>
                    <p className="font-medium text-sm text-gray-900">
                      {formatDuration(job.duration_seconds)}
                    </p>
                  </div>
                )}

                {job.metadata_?.channel && (
                  <div>
                    <p className="text-xs text-gray-500 mb-1 flex items-center gap-1">
                      <User size={12} />
                      Channel
                    </p>
                    <p className="font-medium text-sm text-gray-900 truncate">
                      {String(job.metadata_.channel)}
                    </p>
                  </div>
                )}

                <div>
                  <p className="text-xs text-gray-500 mb-1">Submitted</p>
                  <p className="text-sm text-gray-900">
                    {formatDate(job.created_at)}
                  </p>
                </div>

                {job.completed_at && (
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Completed</p>
                    <p className="text-sm text-gray-900">
                      {formatDate(job.completed_at)}
                    </p>
                  </div>
                )}

                {job.cost_usd != null && job.cost_usd > 0 && (
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Cost</p>
                    <p className="text-sm text-gray-900">
                      ${Number(job.cost_usd).toFixed(4)}
                    </p>
                  </div>
                )}
              </div>

              {/* Time ranges info */}
              {job.time_ranges && job.time_ranges.length > 0 && (
                <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <p className="text-xs font-medium text-amber-900 mb-2">
                    Specific Time Ranges (not full video):
                  </p>
                  <ul className="text-xs text-amber-800 space-y-1">
                    {job.time_ranges.map((range, i) => (
                      <li key={i} className="font-mono">
                        {String(range.start)} &rarr; {String(range.end)}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Chunk Manager - Show if parent job */}
        {isParent && (
          <div className="mt-6">
            <ChunkManager jobId={jobId} isAdmin={isAdmin} />
          </div>
        )}

        {/* Split & Assign button - Show for admin when job completed and not a chunk */}
        {isAdmin &&
          statusStr === 'completed' &&
          !isParent &&
          !isChunk && (
          <div className="mt-6 card p-6 bg-purple-50 border-purple-200">
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
              <div>
                <h3 className="font-semibold text-gray-900 mb-1">
                  Split & Assign to Linguists
                </h3>
                <p className="text-sm text-gray-700">
                  Divide this video into chunks and assign to multiple linguists for parallel processing
                </p>
              </div>
              <Link
                href={`/jobs/${jobId}/split`}
                className="btn-primary flex items-center gap-2 whitespace-nowrap"
              >
                <Scissors size={18} />
                Split Job
              </Link>
            </div>
          </div>
        )}

        {/* Pipeline Progress */}
        {!isParent && !isChunk && (
          <PipelineProgressV2
            currentStage={currentStageIndex}
            completedStages={completedStages}
            failedStage={failedStage}
            compact={false}
          />
        )}

        {/* Review action buttons */}
        {(statusStr === 'awaiting_transcription_review' || statusStr === 'awaiting_translation_review') && (
          <div className="mt-6 card p-6 bg-blue-50 border-blue-200">
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
              <div>
                <h3 className="font-semibold text-gray-900 mb-1">
                  {statusStr === 'awaiting_transcription_review'
                    ? 'Transcription Review Needed'
                    : 'Translation Review Needed'}
                </h3>
                <p className="text-sm text-gray-700">
                  {statusStr === 'awaiting_transcription_review'
                    ? 'Review and edit the transcription before proceeding to translation'
                    : 'Review and edit the translation before exporting'}
                </p>
              </div>
              <Link
                href={statusStr === 'awaiting_transcription_review'
                  ? `/review/transcription/${jobId}`
                  : `/review/translation/${jobId}`}
                className="btn-primary flex items-center gap-2 whitespace-nowrap"
              >
                <Edit2 size={18} />
                Review & Edit
              </Link>
            </div>
          </div>
        )}

        {/* Assign to linguist (admin only) */}
        {isAdmin && statusStr !== 'completed' && statusStr !== 'failed' && (
          <div className="mt-6 card p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Assign to Linguist</h3>
            <div className="relative">
              <button
                onClick={() => setShowAssignDropdown(!showAssignDropdown)}
                className="btn-secondary flex items-center gap-2"
              >
                <User size={18} />
                Select Linguist
              </button>
              {showAssignDropdown && (
                <div className="absolute top-full left-0 mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
                  {users.length === 0 ? (
                    <div className="p-3 text-sm text-gray-600">
                      No linguists available
                    </div>
                  ) : (
                    users
                      .filter((u) => u.role === 'linguist')
                      .map((user) => (
                        <button
                          key={user.username}
                          onClick={() => handleAssignJob(user.username)}
                          disabled={assigningUser === user.username}
                          className="w-full text-left px-4 py-2 hover:bg-gray-50 border-b border-gray-100 last:border-b-0 text-sm disabled:opacity-50"
                        >
                          {String(user.display_name || user.username)} ({String(user.username)})
                        </button>
                      ))
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Status-specific sections */}
        {statusStr === 'failed' && (
          <div className="mt-6 card border-red-200 border-2 p-6">
            <div className="flex items-start gap-4 mb-4">
              <AlertCircle className="text-red-600 flex-shrink-0 mt-1" size={24} />
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-red-900 mb-2">
                  Processing Failed
                </h3>
                {job.error_message && (
                  <p className="text-red-700 text-sm mb-4">{String(job.error_message)}</p>
                )}
              </div>
            </div>

            <button
              onClick={handleRetry}
              disabled={retrying}
              className="btn-primary flex items-center gap-2"
            >
              <RotateCcw size={18} />
              {retrying ? 'Retrying...' : 'Retry Processing'}
            </button>
          </div>
        )}

        {statusStr === 'completed' && (
          <>
            {/* Download section */}
            {job.output_path && (
              <div className="mt-6 card border-green-200 border-2 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <FileText className="text-green-600" size={24} />
                  Translation Ready
                </h3>

                <button
                  onClick={handleDownload}
                  className="btn-primary flex items-center gap-2 mb-6"
                >
                  <Download size={18} />
                  Download Translation (DOCX)
                </button>

                {job.translation && typeof job.translation === 'object' && (
                  <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                    <button
                      onClick={() => setShowTranslation(!showTranslation)}
                      className="font-semibold text-gray-900 mb-3 flex items-center gap-2 hover:text-accent transition-colors"
                    >
                      <Music size={18} />
                      {showTranslation ? 'Hide' : 'Show'} Translation Preview
                    </button>

                    {showTranslation && (
                      <div className="bg-white p-4 rounded border border-gray-200 text-sm text-gray-700 max-h-96 overflow-y-auto whitespace-pre-wrap font-mono">
                        {JSON.stringify(job.translation, null, 2)}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {['downloading', 'transcribing', 'detecting_ost', 'translating', 'exporting', 'queued'].includes(statusStr) && (
          <div className="mt-6 card p-6 bg-blue-50 border-blue-200">
            <div className="flex items-center gap-3 mb-4">
              <Loader className="animate-spin text-accent" size={20} />
              <p className="text-blue-900 font-medium">
                {statusStr === 'queued'
                  ? 'Waiting to process...'
                  : 'Processing your video...'}
              </p>
            </div>

            {job.progress_pct !== undefined && (
              <div>
                <div className="flex items-center justify-between text-sm text-blue-800 mb-2">
                  <span>Progress</span>
                  <span className="font-semibold">{job.progress_pct}%</span>
                </div>
                <div className="w-full h-3 bg-blue-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-accent transition-all duration-300"
                    style={{ width: `${job.progress_pct}%` }}
                  />
                </div>
              </div>
            )}

            <p className="text-xs text-blue-700 mt-3">
              This page will auto-update as your job progresses.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
