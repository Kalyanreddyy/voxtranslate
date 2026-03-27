'use client'

import React, { useEffect, useState } from 'react'
import { AlertCircle, Loader, Check, Clock, User, ChevronRight, GitMerge } from 'lucide-react'
import { reviewApi, ChunkJob, User as UserType } from '@/lib/api'
import axios from 'axios'
import Link from 'next/link'

interface ChunkManagerProps {
  jobId: string
  isAdmin: boolean
}

export default function ChunkManager({ jobId, isAdmin }: ChunkManagerProps) {
  const [chunks, setChunks] = useState<ChunkJob[]>([])
  const [users, setUsers] = useState<UserType[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [merging, setMerging] = useState(false)
  const [reassigningChunk, setReassigningChunk] = useState<string | null>(null)
  const [showReassignDropdown, setShowReassignDropdown] = useState<string | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        const [chunksData, usersData] = await Promise.all([
          reviewApi.getChunks(jobId),
          reviewApi.getUsers(),
        ])
        setChunks(chunksData)
        setUsers(usersData)
        setError('')
      } catch (err) {
        console.error('Failed to fetch chunk data:', err)
        setError('Failed to load chunk information')
      } finally {
        setLoading(false)
      }
    }

    fetchData()

    // Poll for updates every 5 seconds
    const interval = setInterval(fetchData, 5000)
    return () => clearInterval(interval)
  }, [jobId])

  const handleMerge = async () => {
    try {
      setMerging(true)
      await reviewApi.mergeChunks(jobId)
      setError('')
      // Refresh chunks after merge
      const chunksData = await reviewApi.getChunks(jobId)
      setChunks(chunksData)
    } catch (err) {
      console.error('Failed to merge chunks:', err)
      setError('Failed to merge chunks')
    } finally {
      setMerging(false)
    }
  }

  const handleReassign = async (chunkId: string, username: string) => {
    try {
      setReassigningChunk(chunkId)
      await reviewApi.reassignChunk(jobId, username)
      setShowReassignDropdown(null)
      setError('')

      // Refresh chunks
      const chunksData = await reviewApi.getChunks(jobId)
      setChunks(chunksData)
    } catch (err) {
      console.error('Failed to reassign chunk:', err)
      setError('Failed to reassign chunk')
    } finally {
      setReassigningChunk(null)
    }
  }

  const approvedCount = chunks.filter((c) => c.status === 'approved').length
  const totalCount = chunks.length
  const allApproved = approvedCount === totalCount && totalCount > 0
  const progressPercent = totalCount > 0 ? (approvedCount / totalCount) * 100 : 0

  if (loading) {
    return (
      <div className="card p-6">
        <div className="flex items-center justify-center py-8">
          <Loader className="animate-spin text-accent mr-2" size={24} />
          <p className="text-gray-600">Loading chunk information...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Overall progress */}
      <div className="card p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Chunk Progress</h3>

        <div className="space-y-2 mb-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-700">
              {approvedCount} of {totalCount} chunks approved
            </span>
            <span className="font-semibold text-gray-900">
              {totalCount > 0 ? Math.round(progressPercent) : 0}%
            </span>
          </div>
          <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex gap-2 mb-4">
            <AlertCircle className="text-red-600 flex-shrink-0" size={18} />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {allApproved && (
          <button
            onClick={handleMerge}
            disabled={merging}
            className="btn-primary w-full gap-2 flex items-center justify-center"
          >
            <GitMerge size={18} />
            {merging ? 'Merging chunks...' : 'Merge & Export'}
          </button>
        )}
      </div>

      {/* Chunk cards */}
      <div className="space-y-3">
        {chunks.map((chunk) => {
          const linguist = users.find((u) => u.username === chunk.assigned_to)
          const statusConfig = {
            pending_review: {
              label: 'Pending Review',
              bgColor: 'bg-gray-100',
              textColor: 'text-gray-800',
              badgeColor: 'bg-gray-500',
            },
            in_review: {
              label: 'In Review',
              bgColor: 'bg-blue-100',
              textColor: 'text-blue-800',
              badgeColor: 'bg-blue-500',
            },
            approved: {
              label: 'Approved',
              bgColor: 'bg-green-100',
              textColor: 'text-green-800',
              badgeColor: 'bg-green-500',
            },
          }

          const config = statusConfig[chunk.status]

          return (
            <div
              key={chunk.id}
              className="card p-4 border-l-4 border-blue-500"
            >
              <div className="flex items-start justify-between gap-4 mb-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <h4 className="font-semibold text-gray-900">
                      Chunk {chunk.chunk_index + 1} of {chunk.total_chunks}
                    </h4>
                    <span className={`inline-block px-2 py-1 text-xs font-medium text-white rounded ${config.badgeColor}`}>
                      {config.label}
                    </span>
                  </div>

                  <p className="text-sm text-gray-600 font-mono">
                    {chunk.time_range.start} → {chunk.time_range.end}
                  </p>
                </div>

                <Link
                  href={`/jobs/${chunk.id}`}
                  className="flex-shrink-0 p-2 text-accent hover:bg-blue-50 rounded-lg transition-colors"
                  title="View chunk details"
                >
                  <ChevronRight size={20} />
                </Link>
              </div>

              {/* Assigned linguist */}
              <div className="flex items-center justify-between mb-3">
                {linguist ? (
                  <div className="flex items-center gap-2 text-sm text-gray-700">
                    <User size={16} />
                    <span>{linguist.display_name}</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <User size={16} />
                    <span>Unassigned</span>
                  </div>
                )}

                {isAdmin && (
                  <div className="relative">
                    <button
                      onClick={() =>
                        setShowReassignDropdown(
                          showReassignDropdown === chunk.id ? null : chunk.id
                        )
                      }
                      disabled={reassigningChunk === chunk.id}
                      className="text-xs px-2 py-1 text-accent hover:bg-blue-50 border border-blue-300 rounded transition-colors disabled:opacity-50"
                    >
                      Reassign
                    </button>

                    {showReassignDropdown === chunk.id && (
                      <div className="absolute top-full right-0 mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
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
                                onClick={() => handleReassign(chunk.id, user.username)}
                                disabled={reassigningChunk === chunk.id}
                                className="w-full text-left px-4 py-2 hover:bg-gray-50 border-b border-gray-100 last:border-b-0 text-sm disabled:opacity-50"
                              >
                                {user.display_name}
                              </button>
                            ))
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Progress indicator */}
              {chunk.progress !== undefined && (
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-accent transition-all duration-300"
                      style={{ width: `${chunk.progress}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-600 font-medium">
                    {chunk.progress}%
                  </span>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {chunks.length === 0 && (
        <div className="card p-6 text-center text-gray-600">
          <Clock size={32} className="mx-auto mb-3 text-gray-400" />
          <p>No chunks available yet</p>
        </div>
      )}
    </div>
  )
}
