'use client'

import React, { useState, useRef } from 'react'
import { Upload, AlertCircle, CheckCircle2, Clock, Link, Film, Youtube } from 'lucide-react'
import axios from 'axios'
import TimeRangeSelector from './TimeRangeSelector'
import { SCRIBE_LANGUAGES } from '../lib/languages'

interface TimeRange { start: string; end: string }
interface SubmitFormProps { onSuccess?: (jobIds: string[]) => void }
type Mode = 'upload' | 'youtube' | 'url'

export default function SubmitForm({ onSuccess }: SubmitFormProps) {
  const [mode, setMode] = useState<Mode>('upload')

  // Input state
  const [urls, setUrls] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploadProgress, setUploadProgress] = useState(0)

  // Scribe options (matching ElevenLabs UI exactly)
  const [language, setLanguage] = useState('')           // '' = auto-detect
  const [tagAudioEvents, setTagAudioEvents] = useState(true)
  const [includeSubtitles, setIncludeSubtitles] = useState(false)
  const [noVerbatim, setNoVerbatim] = useState(false)
  const [diarize, setDiarize] = useState(true)

  // Other options
  const [detectOST, setDetectOST] = useState(true)
  const [useTimeRanges, setUseTimeRanges] = useState(false)
  const [timeRanges, setTimeRanges] = useState<TimeRange[]>([{ start: '00:00:00', end: '00:01:00' }])

  // UI state
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')

  const validateYouTubeUrl = (url: string) => /^(https?:\/\/)?(www\.)?(youtube|youtu|youtube-nocookie)\.(com|be)\//.test(url.trim())

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
  }

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false)
    const dropped = e.dataTransfer.files[0]
    if (dropped) setFile(dropped)
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0]
    if (selected) setFile(selected)
  }

  const scribeOptions = () => ({
    language_hint: language || 'auto',
    tag_audio_events: tagAudioEvents,
    include_subtitles: includeSubtitles,
    no_verbatim: noVerbatim,
    diarize: diarize,
    enable_ost: detectOST,
    time_ranges: useTimeRanges ? timeRanges : undefined,
  })

  const handleSubmitUpload = async (e: React.FormEvent) => {
    e.preventDefault(); setError(''); setSuccess(false)
    if (!file) { setError('Please select a file to upload'); return }
    setLoading(true); setUploadProgress(0)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const opts = scribeOptions()
      formData.append('language_hint', opts.language_hint)
      formData.append('tag_audio_events', String(opts.tag_audio_events))
      formData.append('include_subtitles', String(opts.include_subtitles))
      formData.append('no_verbatim', String(opts.no_verbatim))
      formData.append('diarize', String(opts.diarize))
      formData.append('enable_ost', String(opts.enable_ost))
      if (useTimeRanges && timeRanges.length > 0) formData.append('time_ranges', JSON.stringify(timeRanges))

      const response = await axios.post('/api/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent) => {
          setUploadProgress(Math.round((progressEvent.loaded * 100) / (progressEvent.total || 1)))
        },
      })
      setSuccessMessage(`File uploaded! Job ID: ${response.data.id}`)
      setSuccess(true); setFile(null); setUploadProgress(0)
      if (onSuccess) onSuccess([response.data.id])
      setTimeout(() => setSuccess(false), 5000)
    } catch (err) { handleAxiosError(err) } finally { setLoading(false) }
  }

  const handleSubmitUrl = async (e: React.FormEvent) => {
    e.preventDefault(); setError(''); setSuccess(false)
    const urlList = urls.split('\n').map((u) => u.trim()).filter(Boolean)
    if (urlList.length === 0) { setError('Please enter at least one URL'); return }
    if (mode === 'youtube') {
      const invalid = urlList.filter((u) => !validateYouTubeUrl(u))
      if (invalid.length > 0) { setError(`Invalid YouTube URLs: ${invalid.slice(0, 2).join(', ')}`); return }
    }
    setLoading(true)
    try {
      const opts = scribeOptions()
      if (urlList.length > 1) {
        const response = await axios.post('/api/batch', { urls: urlList, ...opts })
        setSuccessMessage(`Submitted ${urlList.length} videos!`)
        setSuccess(true); setUrls('')
        if (onSuccess) onSuccess(response.data.job_ids || [])
      } else {
        const response = await axios.post('/api/jobs', {
          youtube_url: urlList[0],
          ...opts,
        })
        setSuccessMessage(`Job submitted! ID: ${response.data.id}`)
        setSuccess(true); setUrls('')
        if (onSuccess) onSuccess([response.data.id])
      }
      setTimeout(() => setSuccess(false), 5000)
    } catch (err) { handleAxiosError(err) } finally { setLoading(false) }
  }

  const handleAxiosError = (err: unknown) => {
    if (axios.isAxiosError(err) && err.response?.data) {
      const data = err.response.data
      if (Array.isArray(data.detail)) setError(data.detail.map((d: any) => String(d.msg || d)).join('; '))
      else if (typeof data.detail === 'string') setError(data.detail)
      else setError('Failed to submit. Please try again.')
    } else { setError('Failed to submit. Please try again.') }
  }

  const tabs: { id: Mode; label: string; icon: React.ReactNode }[] = [
    { id: 'upload', label: 'Upload', icon: <Upload size={15} /> },
    { id: 'youtube', label: 'YouTube', icon: <Youtube size={15} /> },
    { id: 'url', label: 'URL', icon: <Link size={15} /> },
  ]

  return (
    <form onSubmit={mode === 'upload' ? handleSubmitUpload : handleSubmitUrl} className="card p-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Transcribe files</h2>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-gray-200">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setMode(tab.id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium rounded-t-md transition-all border-b-2 -mb-px ${
              mode === tab.id
                ? 'border-gray-900 text-gray-900'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.icon}{tab.label}
          </button>
        ))}
      </div>

      {/* Alerts */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex gap-2">
          <AlertCircle className="flex-shrink-0 text-red-600 mt-0.5" size={16} />
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}
      {success && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg flex gap-2">
          <CheckCircle2 className="flex-shrink-0 text-green-600 mt-0.5" size={16} />
          <p className="text-green-700 text-sm">{successMessage}</p>
        </div>
      )}

      {/* Upload dropzone */}
      {mode === 'upload' && (
        <div className="mb-5">
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleFileDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all ${
              dragOver ? 'border-accent bg-accent/5' : file ? 'border-green-400 bg-green-50' : 'border-gray-300 hover:border-gray-400'
            }`}
          >
            <input ref={fileInputRef} type="file" accept=".mp4,.mkv,.mov,.avi,.webm,.m4v,.mp3,.wav,.m4a" onChange={handleFileSelect} className="hidden" />
            {file ? (
              <div>
                <Film className="mx-auto mb-2 text-green-600" size={28} />
                <p className="font-medium text-gray-900">{file.name}</p>
                <p className="text-sm text-gray-500 mt-1">{formatFileSize(file.size)}</p>
                <button type="button" onClick={(e) => { e.stopPropagation(); setFile(null) }} className="mt-2 text-xs text-red-500 hover:text-red-600">Remove</button>
              </div>
            ) : (
              <div>
                <Upload className="mx-auto mb-3 text-gray-400" size={28} />
                <p className="font-medium text-gray-700">Click or drag files here to upload</p>
                <p className="text-sm text-gray-400 mt-1">Audio & video files, up to 2GB</p>
              </div>
            )}
          </div>
          {loading && uploadProgress > 0 && uploadProgress < 100 && (
            <div className="mt-3">
              <div className="flex justify-between text-xs text-gray-500 mb-1">
                <span>Uploading...</span><span>{uploadProgress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-1.5">
                <div className="bg-accent h-1.5 rounded-full transition-all" style={{ width: `${uploadProgress}%` }} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* URL / YouTube input */}
      {(mode === 'youtube' || mode === 'url') && (
        <div className="mb-5">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {mode === 'youtube' ? 'YouTube URLs' : 'File URLs'}
            <span className="text-gray-400 font-normal ml-2">(one per line)</span>
          </label>
          <textarea
            value={urls}
            onChange={(e) => setUrls(e.target.value)}
            placeholder={mode === 'youtube' ? 'https://www.youtube.com/watch?v=...' : 'https://example.com/video.mp4'}
            className="input-field h-28 resize-none font-mono text-sm"
            disabled={loading}
          />
        </div>
      )}

      {/* Primary language */}
      <div className="mb-4">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-gray-700">Primary language</label>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="input-field w-48 text-sm"
            disabled={loading}
          >
            {SCRIBE_LANGUAGES.map((lang) => (
              <option key={lang.code} value={lang.code}>{lang.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Toggles — matching ElevenLabs UI */}
      <div className="divide-y divide-gray-100 border border-gray-200 rounded-lg overflow-hidden mb-5">
        {[
          { label: 'Tag audio events', desc: 'Identify non-speech sounds like laughter or applause', value: tagAudioEvents, setter: setTagAudioEvents },
          { label: 'Include subtitles', desc: 'Generate SRT/VTT subtitle files alongside transcript', value: includeSubtitles, setter: setIncludeSubtitles },
          { label: 'No verbatim', desc: 'Remove filler words and clean up the transcript', value: noVerbatim, setter: setNoVerbatim },
          { label: 'Speaker diarization', desc: 'Identify and label different speakers', value: diarize, setter: setDiarize },
          { label: 'Detect Original Soundtrack', desc: 'Identify background music and sound effects', value: detectOST, setter: setDetectOST },
        ].map(({ label, desc, value, setter }) => (
          <div key={label} className="flex items-center justify-between px-4 py-3">
            <div>
              <p className="text-sm font-medium text-gray-800">{label}</p>
              <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
            </div>
            <button
              type="button"
              onClick={() => setter(!value)}
              disabled={loading}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${value ? 'bg-gray-900' : 'bg-gray-200'}`}
            >
              <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${value ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
          </div>
        ))}
      </div>

      {/* Time ranges */}
      <div className="mb-5">
        <div className="flex items-center justify-between px-4 py-3 border border-gray-200 rounded-lg">
          <div>
            <p className="text-sm font-medium text-gray-800">Specific timestamps</p>
            <p className="text-xs text-gray-500 mt-0.5">Process only selected time ranges</p>
          </div>
          <button
            type="button"
            onClick={() => setUseTimeRanges(!useTimeRanges)}
            disabled={loading}
            className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${useTimeRanges ? 'bg-gray-900' : 'bg-gray-200'}`}
          >
            <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition duration-200 ease-in-out ${useTimeRanges ? 'translate-x-5' : 'translate-x-0'}`} />
          </button>
        </div>
        {useTimeRanges && (
          <div className="mt-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center gap-2 mb-3">
              <Clock size={16} className="text-blue-600" />
              <h3 className="text-sm font-semibold text-gray-900">Time Ranges</h3>
            </div>
            <TimeRangeSelector ranges={timeRanges} onChange={setTimeRanges} maxRanges={10} />
          </div>
        )}
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={loading || (mode === 'upload' ? !file : urls.trim().length === 0)}
        className="btn-primary w-full gap-2"
      >
        <Upload size={16} />
        {loading
          ? uploadProgress > 0 && uploadProgress < 100
            ? `Uploading ${uploadProgress}%...`
            : 'Processing...'
          : mode === 'upload'
          ? 'Transcribe'
          : 'Submit for Processing'}
      </button>
    </form>
  )
}
