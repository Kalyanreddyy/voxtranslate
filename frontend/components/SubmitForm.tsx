'use client'

import React, { useState } from 'react'
import { Upload, AlertCircle, CheckCircle2, Clock } from 'lucide-react'
import axios from 'axios'
import TimeRangeSelector from './TimeRangeSelector'

interface TimeRange {
  start: string
  end: string
}

interface SubmitFormProps {
  onSuccess?: (jobIds: string[]) => void
}

export default function SubmitForm({ onSuccess }: SubmitFormProps) {
  const [urls, setUrls] = useState('')
  const [language, setLanguage] = useState('en')
  const [detectOST, setDetectOST] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')
  const [useTimeRanges, setUseTimeRanges] = useState(false)
  const [timeRanges, setTimeRanges] = useState<TimeRange[]>([
    { start: '00:00:00', end: '00:01:00' },
  ])

  const validateYouTubeUrl = (url: string) => {
    const youtubeRegex =
      /^(https?:\/\/)?(www\.)?(youtube|youtu|youtube-nocookie)\.(com|be)\//
    return youtubeRegex.test(url.trim())
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess(false)

    const urlList = urls
      .split('\n')
      .map((url) => url.trim())
      .filter((url) => url.length > 0)

    if (urlList.length === 0) {
      setError('Please enter at least one URL')
      return
    }

    const invalidUrls = urlList.filter((url) => !validateYouTubeUrl(url))
    if (invalidUrls.length > 0) {
      setError(
        `Invalid YouTube URLs: ${invalidUrls.slice(0, 2).join(', ')}${invalidUrls.length > 2 ? '...' : ''}`
      )
      return
    }

    // Validate time ranges if selected
    if (useTimeRanges && timeRanges.length === 0) {
      setError('Please add at least one time range')
      return
    }

    setLoading(true)

    try {
      const isBatch = urlList.length > 1

      if (isBatch) {
        const response = await axios.post('/api/batch', {
          urls: urlList,
          language_hint: language,
          enable_ost: detectOST,
        })

        setSuccessMessage(
          `Successfully submitted ${urlList.length} videos for processing!`
        )
        setSuccess(true)
        setUrls('')

        if (onSuccess) {
          onSuccess(response.data.job_ids || [])
        }
      } else {
        const response = await axios.post('/api/jobs', {
          youtube_url: urlList[0],
          language_hint: language,
          enable_ost: detectOST,
          time_ranges: useTimeRanges ? timeRanges : undefined,
        })

        setSuccessMessage(`Job submitted! ID: ${response.data.id}`)
        setSuccess(true)
        setUrls('')

        if (onSuccess) {
          onSuccess([response.data.id])
        }
      }

      setTimeout(() => setSuccess(false), 5000)
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.data) {
        const data = err.response.data
        // Handle Pydantic validation errors (detail is array of objects)
        if (Array.isArray(data.detail)) {
          const messages = data.detail.map((d: any) => String(d.msg || d)).join('; ')
          setError(messages || 'Validation error')
        } else if (typeof data.detail === 'string') {
          setError(data.detail)
        } else if (typeof data.message === 'string') {
          setError(data.message)
        } else if (typeof data.error === 'string') {
          setError(data.error)
        } else {
          setError('Failed to submit job. Please try again.')
        }
      } else {
        setError('Failed to submit job. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card p-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Submit Videos</h2>

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

      {/* Success message */}
      {success && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex gap-3">
          <CheckCircle2 className="flex-shrink-0 text-green-600 mt-0.5" size={20} />
          <div>
            <p className="text-green-800 font-medium">Success</p>
            <p className="text-green-700 text-sm">{successMessage}</p>
          </div>
        </div>
      )}

      {/* URL textarea */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          YouTube URLs
          <span className="text-gray-500 font-normal ml-2">
            (one per line)
          </span>
        </label>
        <textarea
          value={urls}
          onChange={(e) => setUrls(e.target.value)}
          placeholder={
            'https://www.youtube.com/watch?v=...\nhttps://www.youtube.com/watch?v=...'
          }
          className="input-field h-32 resize-none font-mono text-sm"
          disabled={loading}
        />
        <p className="text-xs text-gray-500 mt-2">
          Paste YouTube URLs, one per line. Batch submissions are supported.
        </p>
      </div>

      {/* Language dropdown */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Language Hint
        </label>
        <select
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
          className="input-field"
          disabled={loading}
        >
          <option value="en">English</option>
          <option value="es">Spanish</option>
          <option value="fr">French</option>
          <option value="de">German</option>
          <option value="it">Italian</option>
          <option value="pt">Portuguese</option>
          <option value="ru">Russian</option>
          <option value="ja">Japanese</option>
          <option value="zh">Chinese</option>
          <option value="ko">Korean</option>
          <option value="ar">Arabic</option>
          <option value="hi">Hindi</option>
          <option value="auto">Auto-detect</option>
        </select>
        <p className="text-xs text-gray-500 mt-2">
          The system will attempt to detect the video language automatically.
        </p>
      </div>

      {/* OST detection toggle */}
      <div className="mb-6">
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={detectOST}
            onChange={(e) => setDetectOST(e.target.checked)}
            disabled={loading}
            className="w-4 h-4 rounded border-gray-300 text-accent focus:ring-accent"
          />
          <span className="text-sm font-medium text-gray-700">
            Detect Original Soundtrack (OST)
          </span>
        </label>
        <p className="text-xs text-gray-500 mt-2 ml-7">
          Automatically identify and exclude background music from translation.
        </p>
      </div>

      {/* Time range selection toggle */}
      <div className="mb-6">
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={useTimeRanges}
            onChange={(e) => setUseTimeRanges(e.target.checked)}
            disabled={loading}
            className="w-4 h-4 rounded border-gray-300 text-accent focus:ring-accent"
          />
          <span className="text-sm font-medium text-gray-700">
            Select specific timestamps
          </span>
        </label>
        <p className="text-xs text-gray-500 mt-2 ml-7">
          By default, the entire video is processed. Check to process only specific time ranges.
        </p>
      </div>

      {/* Time range selector */}
      {useTimeRanges && (
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center gap-2 mb-4">
            <Clock size={18} className="text-blue-600" />
            <h3 className="font-semibold text-gray-900">Time Ranges</h3>
          </div>
          <TimeRangeSelector
            ranges={timeRanges}
            onChange={setTimeRanges}
            maxRanges={10}
          />
        </div>
      )}

      {/* Submit button */}
      <button
        type="submit"
        disabled={loading || urls.trim().length === 0}
        className="btn-primary w-full gap-2"
      >
        <Upload size={18} />
        {loading ? 'Submitting...' : 'Submit for Processing'}
      </button>
    </form>
  )
}
