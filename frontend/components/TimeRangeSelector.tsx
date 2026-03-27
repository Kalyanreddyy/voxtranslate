'use client'

import React, { useState, useCallback } from 'react'
import { Clock, Plus, Trash2 } from 'lucide-react'

interface TimeRange {
  start: string
  end: string
}

interface TimeRangeSelectorProps {
  duration?: number // in seconds, optional
  ranges: TimeRange[]
  onChange: (ranges: TimeRange[]) => void
  maxRanges?: number
}

export default function TimeRangeSelector({
  duration,
  ranges,
  onChange,
  maxRanges = 10,
}: TimeRangeSelectorProps) {
  const [errors, setErrors] = useState<string[]>([])

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

  // Validate ranges
  const validateRanges = useCallback((newRanges: TimeRange[]): string[] => {
    const validationErrors: string[] = []

    for (let i = 0; i < newRanges.length; i++) {
      const range = newRanges[i]

      // Check timestamp format
      if (!isValidTimestamp(range.start)) {
        validationErrors.push(`Range ${i + 1}: Invalid start time format`)
        continue
      }
      if (!isValidTimestamp(range.end)) {
        validationErrors.push(`Range ${i + 1}: Invalid end time format`)
        continue
      }

      const startSeconds = timestampToSeconds(range.start)
      const endSeconds = timestampToSeconds(range.end)

      // Check start < end
      if (startSeconds >= endSeconds) {
        validationErrors.push(`Range ${i + 1}: Start time must be before end time`)
        continue
      }

      // Check against video duration
      if (duration && endSeconds > duration) {
        validationErrors.push(
          `Range ${i + 1}: End time exceeds video duration (${secondsToTimestamp(duration)})`
        )
        continue
      }

      // Check for overlaps with other ranges
      for (let j = 0; j < newRanges.length; j++) {
        if (i === j) continue

        const otherStart = timestampToSeconds(newRanges[j].start)
        const otherEnd = timestampToSeconds(newRanges[j].end)

        // Check if ranges overlap
        if (startSeconds < otherEnd && endSeconds > otherStart) {
          validationErrors.push(
            `Range ${i + 1} overlaps with Range ${j + 1}`
          )
          break
        }
      }
    }

    return validationErrors
  }, [duration])

  // Update a specific range
  const updateRange = (index: number, field: 'start' | 'end', value: string) => {
    const newRanges = [...ranges]
    newRanges[index] = { ...newRanges[index], [field]: value }

    const validationErrors = validateRanges(newRanges)
    setErrors(validationErrors)
    onChange(newRanges)
  }

  // Add a new range
  const addRange = () => {
    if (ranges.length >= maxRanges) {
      setErrors([`Maximum ${maxRanges} ranges allowed`])
      return
    }

    const newRange: TimeRange = { start: '00:00:00', end: '00:00:30' }
    const newRanges = [...ranges, newRange]

    const validationErrors = validateRanges(newRanges)
    setErrors(validationErrors)
    onChange(newRanges)
  }

  // Remove a range
  const removeRange = (index: number) => {
    if (ranges.length <= 1) return

    const newRanges = ranges.filter((_, i) => i !== index)
    const validationErrors = validateRanges(newRanges)
    setErrors(validationErrors)
    onChange(newRanges)
  }

  // Calculate timeline bar segments
  const getTimelineSegments = () => {
    if (!duration || duration === 0) return []

    return ranges.map((range) => {
      const startPercent = (timestampToSeconds(range.start) / duration) * 100
      const endPercent = (timestampToSeconds(range.end) / duration) * 100
      return {
        start: startPercent,
        width: endPercent - startPercent,
      }
    })
  }

  const timelineSegments = getTimelineSegments()

  return (
    <div className="space-y-4">
      {/* Timeline visualization */}
      {duration && (
        <div>
          <p className="text-sm font-medium text-gray-700 mb-2">Timeline</p>
          <div className="h-10 bg-gray-200 rounded-lg overflow-hidden relative">
            {timelineSegments.map((segment, i) => (
              <div
                key={i}
                className="absolute h-full bg-blue-500"
                style={{
                  left: `${segment.start}%`,
                  width: `${segment.width}%`,
                }}
              />
            ))}
            <div className="absolute inset-0 flex items-center px-3 text-xs font-medium text-gray-600 pointer-events-none">
              {duration > 0 && (
                <span className="ml-auto">{secondsToTimestamp(duration)}</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Validation errors */}
      {errors.length > 0 && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm font-medium text-red-900 mb-2">Validation errors:</p>
          <ul className="text-sm text-red-700 space-y-1">
            {errors.map((error, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="mt-1">•</span>
                <span>{error}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Range inputs */}
      <div className="space-y-3">
        {ranges.map((range, index) => (
          <div key={index} className="flex gap-3 items-end">
            {/* Index label */}
            <div className="w-8 flex-shrink-0">
              <p className="text-xs font-medium text-gray-600">
                {index + 1}
              </p>
            </div>

            {/* Start time input */}
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Start
              </label>
              <input
                type="text"
                value={range.start}
                onChange={(e) => updateRange(index, 'start', e.target.value)}
                placeholder="00:00:00"
                className="input-field font-mono text-sm"
              />
            </div>

            {/* End time input */}
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-700 mb-1">
                End
              </label>
              <input
                type="text"
                value={range.end}
                onChange={(e) => updateRange(index, 'end', e.target.value)}
                placeholder="00:00:00"
                className="input-field font-mono text-sm"
              />
            </div>

            {/* Remove button */}
            {ranges.length > 1 && (
              <button
                onClick={() => removeRange(index)}
                type="button"
                className="flex-shrink-0 p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                aria-label="Remove range"
              >
                <Trash2 size={18} />
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Add range button */}
      {ranges.length < maxRanges && (
        <button
          onClick={addRange}
          type="button"
          className="flex items-center gap-2 text-accent hover:text-accent-dark font-medium mt-4"
        >
          <Plus size={18} />
          Add Range
        </button>
      )}

      {/* Help text */}
      <p className="text-xs text-gray-600 mt-3">
        <Clock className="inline mr-1" size={14} />
        Enter time ranges in HH:MM:SS format. Ranges cannot overlap.
      </p>
    </div>
  )
}
