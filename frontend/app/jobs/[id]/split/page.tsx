'use client'

export const dynamic = 'force-dynamic'

import React, { useEffect, useState } from 'react'
import axios from 'axios'
import { useParams, useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Loader,
  AlertCircle,
  Scissors,
  Plus,
  ChevronRight,
  Users,
} from 'lucide-react'
import Link from 'next/link'
import { reviewApi, ChunkDefinition, User as UserType } from '@/lib/api'

interface JobDetail {
  id: string
  title: string
  duration?: string
  language?: string
  metadata?: {
    thumbnail?: string
  }
}

interface ChunkPreview {
  start: string
  end: string
  assign_to?: string
  index: number
}

export default function JobSplitPage() {
  const params = useParams()
  const router = useRouter()
  const jobId = params.id as string

  const [job, setJob] = useState<JobDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [users, setUsers] = useState<UserType[]>([])
  const [splitPoints, setSplitPoints] = useState<string[]>([
    '00:00:00',
    '00:05:00',
  ])
  const [manualInput, setManualInput] = useState('')
  const [chunks, setChunks] = useState<ChunkPreview[]>([])
  const [splitting, setSplitting] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState<number | null>(null)

  // Convert seconds to HH:MM:SS format
  const secondsToTimestamp = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = Math.floor(seconds % 60)
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
  }

  // Convert HH:MM:SS to seconds
  const timestampToSeconds = (timestamp: string): number => {
    const parts = timestamp.split(':')
    if (parts.length !== 3) return 0
    const hours = parseInt(parts[0], 10) || 0
    const minutes = parseInt(parts[1], 10) || 0
    const secs = parseInt(parts[2], 10) || 0
    return hours * 3600 + minutes * 60 + secs
  }

  // Validate timestamp format
  const isValidTimestamp = (timestamp: string): boolean => {
    const pattern = /^(\d{1,2}):(\d{2}):(\d{2})$/
    if (!pattern.test(timestamp)) return false
    const [h, m, s] = timestamp.split(':').map(Number)
    return h >= 0 && m >= 0 && m < 60 && s >= 0 && s < 60
  }

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        const jobData = await axios.get(`/api/jobs/${jobId}`)
        setJob(jobData.data)

        const usersData = await reviewApi.getUsers()
        setUsers(usersData)

        setError('')
      } catch (err) {
        console.error('Failed to fetch data:', err)
        setError('Failed to load job details')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [jobId])

  // Generate chunk previews from split points
  useEffect(() => {
    const sortedPoints = [...splitPoints]
      .filter((p) => isValidTimestamp(p))
      .sort((a, b) => timestampToSeconds(a) - timestampToSeconds(b))

    // Add end point if not present
    if (sortedPoints.length === 0) return

    const validPoints = [sortedPoints[0]]
    for (let i = 1; i < sortedPoints.length; i++) {
      if (timestampToSeconds(sortedPoints[i]) > timestampToSeconds(validPoints[validPoints.length - 1])) {
        validPoints.push(sortedPoints[i])
      }
    }

    // Generate chunks
    const newChunks: ChunkPreview[] = []
    for (let i = 0; i < validPoints.length; i++) {
      newChunks.push({
        start: validPoints[i],
        end: validPoints[i + 1] || '99:59:59',
        index: i,
      })
    }

    setChunks(newChunks)
  }, [splitPoints])

  const addSplitPoint = () => {
    if (!isValidTimestamp(manualInput)) {
      setError('Invalid timestamp format. Use HH:MM:SS')
      return
    }

    if (splitPoints.includes(manualInput)) {
      setError('This split point already exists')
      return
    }

    setSplitPoints([...splitPoints, manualInput])
    setManualInput('')
    setError('')
  }

  const removeSplitPoint = (point: string) => {
    if (splitPoints.length <= 1) return
    setSplitPoints(splitPoints.filter((p) => p !== point))
  }

  const assignChunk = (chunkIndex: number, username: string) => {
    const newChunks = chunks.map((c, i) =>
      i === chunkIndex ? { ...c, assign_to: username } : c
    )
    setChunks(newChunks)
    setDropdownOpen(null)
  }

  const handleSplit = async () => {
    try {
      setSplitting(true)

      const chunkDefs: ChunkDefinition[] = chunks.map((chunk) => ({
        start: chunk.start,
        end: chunk.end,
        assign_to: chunk.assign_to,
      }))

      const result = await reviewApi.splitJob(jobId, chunkDefs)

      // Redirect back to job detail
      router.push(`/jobs/${jobId}`)
    } catch (err) {
      console.error('Failed to split job:', err)
      setError('Failed to split job. Please try again.')
    } finally {
      setSplitting(false)
    }
  }

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
          </div>
        </div>
      </div>
    )
  }

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

        {/* Header */}
        <div className="card p-6 mb-6">
          <div className="flex gap-6 mb-4">
            {job.metadata?.thumbnail && (
              <div className="flex-shrink-0 w-32 h-24 bg-gray-200 rounded-lg overflow-hidden">
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

            <div className="flex-1">
              <h1 className="text-2xl font-bold text-gray-900 mb-2">{job.title}</h1>
              <div className="flex gap-4 text-sm text-gray-600">
                {job.language && <div>Language: {job.language}</div>}
                {job.duration && <div>Duration: {job.duration}</div>}
              </div>
            </div>
          </div>
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

        {/* Split points editor */}
        <div className="card p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Scissors size={20} />
            Set Split Points
          </h2>

          <div className="space-y-4">
            {/* Manual input */}
            <div className="flex gap-2">
              <input
                type="text"
                value={manualInput}
                onChange={(e) => setManualInput(e.target.value)}
                placeholder="00:00:00"
                className="input-field font-mono text-sm flex-1"
              />
              <button
                onClick={addSplitPoint}
                className="btn-secondary gap-2 flex items-center"
              >
                <Plus size={18} />
                Add Point
              </button>
            </div>

            {/* List of split points */}
            <div className="space-y-2">
              {splitPoints.map((point, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded-lg"
                >
                  <span className="font-mono font-semibold text-gray-900">
                    {point}
                  </span>
                  {splitPoints.length > 1 && (
                    <button
                      onClick={() => removeSplitPoint(point)}
                      className="text-sm text-red-600 hover:bg-red-50 px-2 py-1 rounded transition-colors"
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
            </div>

            <p className="text-xs text-gray-600">
              Split points define where the video will be divided into chunks.
              Each chunk starts at one split point and ends at the next.
            </p>
          </div>
        </div>

        {/* Chunks preview */}
        <div className="card p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Chunk Preview ({chunks.length} chunks)
          </h2>

          <div className="space-y-3">
            {chunks.map((chunk) => {
              const linguist = users.find((u) => u.username === chunk.assign_to)

              return (
                <div
                  key={chunk.index}
                  className="border border-gray-200 rounded-lg p-4"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-1">
                        Chunk {chunk.index + 1}
                      </h4>
                      <p className="text-sm font-mono text-gray-600">
                        {chunk.start} → {chunk.end}
                      </p>
                    </div>
                  </div>

                  {/* Assign linguist dropdown */}
                  <div className="relative">
                    <button
                      onClick={() =>
                        setDropdownOpen(
                          dropdownOpen === chunk.index ? null : chunk.index
                        )
                      }
                      className="flex items-center gap-2 text-sm px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <Users size={16} />
                      {linguist
                        ? linguist.display_name
                        : 'Assign Linguist'}
                      <ChevronRight size={14} />
                    </button>

                    {dropdownOpen === chunk.index && (
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
                                onClick={() => assignChunk(chunk.index, user.username)}
                                className="w-full text-left px-4 py-2 hover:bg-gray-50 border-b border-gray-100 last:border-b-0 text-sm"
                              >
                                {user.display_name}
                              </button>
                            ))
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {chunks.length === 0 && (
            <div className="text-center py-8 text-gray-600">
              <AlertCircle size={32} className="mx-auto mb-2 text-gray-400" />
              <p>No valid chunks. Add split points to create chunks.</p>
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex gap-4">
          <button
            onClick={() => router.back()}
            className="btn-secondary flex-1"
          >
            Cancel
          </button>
          <button
            onClick={handleSplit}
            disabled={splitting || chunks.length === 0}
            className="btn-primary flex-1 gap-2 flex items-center justify-center"
          >
            <Scissors size={18} />
            {splitting ? 'Splitting...' : 'Split & Assign'}
          </button>
        </div>
      </div>
    </div>
  )
}
