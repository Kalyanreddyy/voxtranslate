'use client'

export const dynamic = 'force-dynamic'

import React, { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import axios from 'axios'
import PipelineProgressV2 from '@/components/PipelineProgressV2'
import { reviewApi, Segment } from '@/lib/api'
import {
  ArrowLeft,
  Loader,
  AlertCircle,
  CheckCircle,
  Clock,
  Globe,
  User,
  FileText,
  Save,
} from 'lucide-react'
import Link from 'next/link'

interface JobDetail {
  id: string
  title: string
  duration?: string
  language?: string
  metadata?: {
    thumbnail?: string
    channel?: string
    speakers?: number
    confidence?: number
  }
  pipeline_state?: {
    current_stage?: number
    completed_stages?: number[]
  }
}

export default function TranscriptionReviewPage() {
  const params = useParams()
  const router = useRouter()
  const jobId = params.id as string

  const [job, setJob] = useState<JobDetail | null>(null)
  const [segments, setSegments] = useState<Segment[]>([])
  const [editedSegments, setEditedSegments] = useState<Set<number>>(new Set())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle')

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        // Fetch job details
        const jobRes = await axios.get(`/api/jobs/${jobId}`)
        setJob(jobRes.data)

        // Fetch transcription
        const transcriptionRes = await reviewApi.getTranscription(jobId)
        setSegments((transcriptionRes as any).transcription?.segments || transcriptionRes.segments || [])
        setError('')
      } catch (err) {
        console.error('Failed to fetch data:', err)
        setError('Failed to load transcription data')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [jobId])

  const handleSegmentChange = (index: number, text: string) => {
    const newSegments = [...segments]
    newSegments[index] = { ...newSegments[index], text }
    setSegments(newSegments)

    const newEdited = new Set(editedSegments)
    newEdited.add(index)
    setEditedSegments(newEdited)
  }

  const formatTimestamp = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = Math.floor(seconds % 60)
    const ms = Math.floor((seconds % 1) * 1000)
    return `${String(hours).padStart(2, '0')}.${String(minutes).padStart(2, '0')}.${String(secs).padStart(2, '0')}`
  }

  const handleApprove = async () => {
    try {
      setSaving(true)
      setAutoSaveStatus('saving')
      const reviewData = { segments }
      await reviewApi.submitTranscriptionReview(jobId, reviewData)
      setAutoSaveStatus('saved')
      setTimeout(() => {
        router.push(`/jobs/${jobId}`)
      }, 1000)
    } catch (err) {
      console.error('Failed to submit review:', err)
      setError('Failed to submit transcription review')
      setAutoSaveStatus('idle')
    } finally {
      setSaving(false)
    }
  }

  const handleSkip = async () => {
    try {
      setSaving(true)
      await reviewApi.skipTranscriptionReview(jobId)
      router.push(`/jobs/${jobId}`)
    } catch (err) {
      console.error('Failed to skip review:', err)
      setError('Failed to skip review')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex-1 overflow-auto">
        <div className="p-6 lg:p-8 max-w-5xl mx-auto">
          <div className="flex items-center justify-center h-96">
            <div className="text-center">
              <Loader className="animate-spin text-accent mx-auto mb-4" size={32} />
              <p className="text-gray-600">Loading transcription...</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-auto">
      <div className="p-6 lg:p-8 max-w-5xl mx-auto">
        {/* Back button */}
        <Link
          href={`/jobs/${jobId}`}
          className="flex items-center gap-2 text-accent hover:text-accent-dark font-medium mb-6"
        >
          <ArrowLeft size={20} />
          Back to Job
        </Link>

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

        {/* Video Info Card */}
        {job && (
          <div className="card p-6 mb-6">
            <div className="flex flex-col md:flex-row gap-6">
              {/* Thumbnail */}
              {job.metadata?.thumbnail && (
                <div className="flex-shrink-0 w-full md:w-48 h-32 bg-gray-200 rounded-lg overflow-hidden">
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

              {/* Info */}
              <div className="flex-1">
                <h1 className="text-2xl font-bold text-gray-900 mb-2">
                  {job.title}
                </h1>

                {/* Metadata grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {job.language && (
                    <div>
                      <p className="text-xs text-gray-500 mb-1 flex items-center gap-1">
                        <Globe size={12} />
                        Language
                      </p>
                      <p className="font-medium text-sm text-gray-900">
                        {job.language}
                      </p>
                    </div>
                  )}

                  {job.duration && (
                    <div>
                      <p className="text-xs text-gray-500 mb-1 flex items-center gap-1">
                        <Clock size={12} />
                        Duration
                      </p>
                      <p className="font-medium text-sm text-gray-900">
                        {job.duration}
                      </p>
                    </div>
                  )}

                  {job.metadata?.channel && (
                    <div>
                      <p className="text-xs text-gray-500 mb-1 flex items-center gap-1">
                        <User size={12} />
                        Channel
                      </p>
                      <p className="font-medium text-sm text-gray-900 truncate">
                        {job.metadata.channel}
                      </p>
                    </div>
                  )}

                  {job.metadata?.confidence !== undefined && (
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Confidence</p>
                      <p className="font-medium text-sm text-gray-900">
                        {Math.round(job.metadata.confidence * 100)}%
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Pipeline Progress */}
        {job?.pipeline_state && (
          <PipelineProgressV2
            currentStage={job.pipeline_state.current_stage ?? 2}
            completedStages={job.pipeline_state.completed_stages ?? []}
            compact={true}
          />
        )}

        {/* Segments Editor */}
        <div className="mt-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900">
              Transcription Segments ({segments.length})
            </h2>
            <div className="flex items-center gap-2">
              {autoSaveStatus === 'saving' && (
                <span className="text-sm text-amber-600 flex items-center gap-1">
                  <Loader size={14} className="animate-spin" />
                  Saving...
                </span>
              )}
              {autoSaveStatus === 'saved' && (
                <span className="text-sm text-green-600 flex items-center gap-1">
                  <CheckCircle size={14} />
                  Saved
                </span>
              )}
            </div>
          </div>

          {segments.length === 0 ? (
            <div className="card p-8 text-center">
              <p className="text-gray-600">No segments found</p>
            </div>
          ) : (
            <div className="space-y-3">
              {segments.map((segment, index) => (
                <div
                  key={index}
                  className={`card p-4 ${
                    editedSegments.has(index) ? 'bg-yellow-50 border-yellow-200' : ''
                  }`}
                >
                  <div className="flex gap-4">
                    {/* Timestamp */}
                    <div className="flex-shrink-0 pt-2">
                      <p className="font-mono text-sm text-gray-600">
                        {formatTimestamp(segment.start)}-{formatTimestamp(segment.end)}
                      </p>
                    </div>

                    {/* Textarea */}
                    <div className="flex-1">
                      <textarea
                        value={segment.text || ''}
                        onChange={(e) => handleSegmentChange(index, e.target.value)}
                        className="input-field min-h-24 font-mono text-sm"
                        placeholder="Enter transcription..."
                      />
                      {editedSegments.has(index) && (
                        <p className="text-xs text-amber-600 mt-1">Edited</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Bottom action bar */}
        <div className="mt-8 sticky bottom-0 bg-white border-t border-gray-200 -mx-6 lg:-mx-8 px-6 lg:px-8 py-4 flex gap-4 justify-between">
          <button
            onClick={handleSkip}
            disabled={saving}
            className="btn-secondary"
          >
            Skip to Translation
          </button>
          <button
            onClick={handleApprove}
            disabled={saving}
            className="btn-primary flex items-center gap-2"
          >
            <CheckCircle size={18} />
            {saving ? 'Saving...' : 'Approve & Continue Pipeline'}
          </button>
        </div>
      </div>
    </div>
  )
}
