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
  AlertTriangle,
  Download,
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
  }
  pipeline_state?: {
    current_stage?: number
    completed_stages?: number[]
  }
}

interface TranslationSegment extends Segment {
  translation?: string
  notes?: string
  critical_flags?: Array<{ type: string; message: string }>
}

export default function TranslationReviewPage() {
  const params = useParams()
  const router = useRouter()
  const jobId = params.id as string

  const [job, setJob] = useState<JobDetail | null>(null)
  const [segments, setSegments] = useState<TranslationSegment[]>([])
  const [originalSegments, setOriginalSegments] = useState<Segment[]>([])
  const [summary, setSummary] = useState('')
  const [editedSegments, setEditedSegments] = useState<Set<number>>(new Set())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState<'translation' | 'notes' | 'ost' | 'summary'>('translation')
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle')

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        // Fetch job details
        const jobRes = await axios.get(`/api/jobs/${jobId}`)
        setJob(jobRes.data)

        // Fetch transcription for original text
        const transcriptionRes = await reviewApi.getTranscription(jobId)
        setOriginalSegments(transcriptionRes.segments || [])

        // Fetch translation
        const translationRes = await reviewApi.getTranslation(jobId)
        setSegments(translationRes.segments || [])
        setError('')
      } catch (err) {
        console.error('Failed to fetch data:', err)
        setError('Failed to load translation data')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [jobId])

  const handleSegmentChange = (index: number, field: 'translation' | 'notes', value: string) => {
    const newSegments = [...segments]
    newSegments[index] = { ...newSegments[index], [field]: value }
    setSegments(newSegments)

    const newEdited = new Set(editedSegments)
    newEdited.add(index)
    setEditedSegments(newEdited)
  }

  const formatTimestamp = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = Math.floor(seconds % 60)
    return `${String(hours).padStart(2, '0')}.${String(minutes).padStart(2, '0')}.${String(secs).padStart(2, '0')}`
  }

  const handleApprove = async () => {
    try {
      setSaving(true)
      setAutoSaveStatus('saving')
      const reviewData = {
        segments: segments.map((s) => ({
          start: s.start,
          end: s.end,
          translation: s.translation || '',
          notes: s.notes || '',
        })),
        summary: summary,
      }
      await reviewApi.submitTranslationReview(jobId, reviewData)
      setAutoSaveStatus('saved')
      setTimeout(() => {
        router.push(`/jobs/${jobId}`)
      }, 1000)
    } catch (err) {
      console.error('Failed to submit review:', err)
      setError('Failed to submit translation review')
      setAutoSaveStatus('idle')
    } finally {
      setSaving(false)
    }
  }

  const handleRequestRetranslation = async () => {
    try {
      setSaving(true)
      // This would be a new endpoint for requesting re-translation
      await axios.post(`/api/jobs/${jobId}/request-retranslation`, {
        notes: 'Requested retranslation from linguist',
      })
      router.push(`/jobs/${jobId}`)
    } catch (err) {
      console.error('Failed to request retranslation:', err)
      setError('Failed to request retranslation')
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
              <p className="text-gray-600">Loading translation...</p>
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
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Pipeline Progress */}
        {job?.pipeline_state && (
          <PipelineProgressV2
            currentStage={job.pipeline_state.current_stage ?? 4}
            completedStages={job.pipeline_state.completed_stages ?? []}
            compact={true}
          />
        )}

        {/* Tabs */}
        <div className="mt-6 border-b border-gray-200 flex gap-0">
          {['translation', 'notes', 'ost', 'summary'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as any)}
              className={`px-4 py-3 font-medium transition-colors ${
                activeTab === tab
                  ? 'border-b-2 border-accent text-accent'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {tab === 'translation' && 'Translation'}
              {tab === 'notes' && 'Notes & Flags'}
              {tab === 'ost' && 'OST'}
              {tab === 'summary' && 'Video Summary'}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="mt-6 space-y-4">
          {/* Translation Tab */}
          {activeTab === 'translation' && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-gray-900">
                Translation Segments ({segments.length})
              </h2>

              {segments.length === 0 ? (
                <div className="card p-8 text-center">
                  <p className="text-gray-600">No segments found</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {segments.map((segment, index) => {
                    const original = originalSegments[index]
                    return (
                      <div
                        key={index}
                        className={`card p-4 ${
                          editedSegments.has(index) ? 'bg-yellow-50 border-yellow-200' : ''
                        }`}
                      >
                        <p className="font-mono text-sm text-gray-600 mb-3">
                          {formatTimestamp(segment.start)}-{formatTimestamp(segment.end)}
                        </p>

                        {/* Critical flags */}
                        {segment.critical_flags && segment.critical_flags.length > 0 && (
                          <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                            {segment.critical_flags.map((flag, i) => (
                              <p key={i} className="text-sm text-red-700 flex items-start gap-2">
                                <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
                                <span>{flag.message}</span>
                              </p>
                            ))}
                          </div>
                        )}

                        <div className="grid grid-cols-2 gap-4">
                          {/* Original (read-only) */}
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Original
                            </label>
                            <textarea
                              value={original?.text || ''}
                              disabled
                              className="input-field min-h-20 bg-gray-50 cursor-not-allowed font-mono text-sm"
                            />
                          </div>

                          {/* Translation (editable) */}
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Translation
                            </label>
                            <textarea
                              value={segment.translation || ''}
                              onChange={(e) =>
                                handleSegmentChange(index, 'translation', e.target.value)
                              }
                              className="input-field min-h-20 font-mono text-sm"
                              placeholder="Enter translation..."
                            />
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* Notes & Flags Tab */}
          {activeTab === 'notes' && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-gray-900">Notes & Translation Flags</h2>

              {segments.filter((s) => s.notes || s.critical_flags?.length).length === 0 ? (
                <div className="card p-8 text-center">
                  <p className="text-gray-600">No notes or flags</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {segments.map((segment, index) => {
                    if (!segment.notes && !segment.critical_flags?.length) return null

                    return (
                      <div key={index} className="card p-4">
                        <p className="font-mono text-sm text-gray-600 mb-3">
                          {formatTimestamp(segment.start)}-{formatTimestamp(segment.end)}
                        </p>

                        {segment.critical_flags && segment.critical_flags.length > 0 && (
                          <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                            <p className="font-medium text-red-900 mb-2">Critical Flags:</p>
                            {segment.critical_flags.map((flag, i) => (
                              <p key={i} className="text-sm text-red-700">
                                {flag.message}
                              </p>
                            ))}
                          </div>
                        )}

                        {segment.notes && (
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Notes
                            </label>
                            <textarea
                              value={segment.notes}
                              onChange={(e) =>
                                handleSegmentChange(index, 'notes', e.target.value)
                              }
                              className="input-field min-h-20 font-mono text-sm"
                            />
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* OST Tab */}
          {activeTab === 'ost' && (
            <div className="card p-8 text-center">
              <p className="text-gray-600">No OST detected</p>
            </div>
          )}

          {/* Summary Tab */}
          {activeTab === 'summary' && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-gray-900">Video Summary</h2>
              <textarea
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                placeholder="Enter video summary (optional)..."
                className="input-field min-h-40 font-mono text-sm"
              />
            </div>
          )}
        </div>

        {/* Bottom action bar */}
        <div className="mt-8 sticky bottom-0 bg-white border-t border-gray-200 -mx-6 lg:-mx-8 px-6 lg:px-8 py-4 flex gap-4 justify-between flex-wrap">
          <button
            onClick={handleRequestRetranslation}
            disabled={saving}
            className="btn-secondary"
          >
            Request Re-translation
          </button>
          <button
            onClick={handleApprove}
            disabled={saving}
            className="btn-primary flex items-center gap-2"
          >
            <Download size={18} />
            {saving ? 'Exporting...' : 'Approve & Export DOCX'}
          </button>
        </div>
      </div>
    </div>
  )
}
