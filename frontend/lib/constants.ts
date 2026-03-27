/**
 * Application constants
 */

export const APP_NAME = 'VoxTranslate'
export const APP_VERSION = '1.0.0'
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000'

/**
 * Job status constants
 */
export const JOB_STATUS = {
  COMPLETED: 'completed',
  PROCESSING: 'processing',
  FAILED: 'failed',
  QUEUED: 'queued',
  PENDING: 'pending',
} as const

export type JobStatusType = typeof JOB_STATUS[keyof typeof JOB_STATUS]

/**
 * Pipeline stages
 */
export const PIPELINE_STAGES = [
  { index: 0, name: 'Download', label: 'Download' },
  { index: 1, name: 'Transcribe', label: 'Transcribe' },
  { index: 2, name: 'Detect OST', label: 'Detect OST' },
  { index: 3, name: 'Translate', label: 'Translate' },
  { index: 4, name: 'Export', label: 'Export' },
] as const

/**
 * Supported languages
 */
export const LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Spanish' },
  { code: 'fr', name: 'French' },
  { code: 'de', name: 'German' },
  { code: 'it', name: 'Italian' },
  { code: 'pt', name: 'Portuguese' },
  { code: 'ru', name: 'Russian' },
  { code: 'ja', name: 'Japanese' },
  { code: 'zh', name: 'Chinese' },
  { code: 'ko', name: 'Korean' },
  { code: 'ar', name: 'Arabic' },
  { code: 'hi', name: 'Hindi' },
  { code: 'auto', name: 'Auto-detect' },
] as const

export type LanguageCode = typeof LANGUAGES[number]['code']

/**
 * API endpoints
 */
export const API_ENDPOINTS = {
  STATS: '/api/stats',
  JOBS: '/api/jobs',
  JOB_DETAIL: (id: string) => `/api/jobs/${id}`,
  JOB_EVENTS: (id: string) => `/api/jobs/${id}/events`,
  JOB_DOWNLOAD: (id: string) => `/api/jobs/${id}/download`,
  JOB_RETRY: (id: string) => `/api/jobs/${id}/retry`,
  HEALTH: '/api/health',
} as const

/**
 * Pagination constants
 */
export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 25,
  MAX_LIMIT: 100,
} as const

/**
 * Cache durations (in milliseconds)
 */
export const CACHE_DURATION = {
  STATS: 10 * 1000, // 10 seconds
  JOBS: 5 * 1000, // 5 seconds
  HEALTH: 30 * 1000, // 30 seconds
} as const

/**
 * Timeouts (in milliseconds)
 */
export const TIMEOUTS = {
  API_REQUEST: 30 * 1000, // 30 seconds
  DEBOUNCE: 300, // 300ms
  TOAST: 5 * 1000, // 5 seconds
} as const

/**
 * Color scheme
 */
export const COLORS = {
  SIDEBAR: '#1a1a2e',
  ACCENT: '#3b82f6',
  ACCENT_DARK: '#1e40af',
  SUCCESS: '#10b981',
  WARNING: '#f59e0b',
  ERROR: '#ef4444',
  GRAY_50: '#f9fafb',
  GRAY_100: '#f3f4f6',
  GRAY_200: '#e5e7eb',
  GRAY_300: '#d1d5db',
  GRAY_400: '#9ca3af',
  GRAY_500: '#6b7280',
  GRAY_600: '#4b5563',
  GRAY_700: '#374151',
  GRAY_800: '#1f2937',
  GRAY_900: '#111827',
} as const

/**
 * Validation constants
 */
export const VALIDATION = {
  MAX_BATCH_SIZE: 50,
  MAX_URL_LENGTH: 2048,
  MIN_TITLE_LENGTH: 1,
  MAX_TITLE_LENGTH: 255,
} as const

/**
 * Error messages
 */
export const ERROR_MESSAGES = {
  NETWORK_ERROR: 'Network error. Please check your connection.',
  INVALID_URL: 'Invalid YouTube URL',
  API_ERROR: 'Failed to connect to the API server',
  UNKNOWN_ERROR: 'An unexpected error occurred',
  INVALID_FORM: 'Please fill in all required fields',
} as const

/**
 * Success messages
 */
export const SUCCESS_MESSAGES = {
  JOB_SUBMITTED: 'Job submitted successfully',
  JOB_RETRIED: 'Job retry initiated',
  COPIED_TO_CLIPBOARD: 'Copied to clipboard',
} as const

/**
 * Regular expressions
 */
export const REGEX = {
  YOUTUBE_URL: /^(https?:\/\/)?(www\.)?(youtube|youtu|youtube-nocookie)\.(com|be)\//,
  VIDEO_ID: /^.*(youtu\.be\/|v\/|u\/\w\/|embed\/|watch\?v=)([^#\&\?]*).*/,
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  URL: /^https?:\/\/.+/,
} as const

/**
 * Navigation menu items
 */
export const NAV_ITEMS = [
  { href: '/', label: 'Dashboard', icon: 'LayoutDashboard' },
  { href: '/submit', label: 'Submit Job', icon: 'Upload' },
  { href: '/jobs', label: 'Job Queue', icon: 'ListTodo' },
  { href: '/settings', label: 'Settings', icon: 'Settings' },
] as const

/**
 * Responsive breakpoints (matches Tailwind)
 */
export const BREAKPOINTS = {
  xs: 0,
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
} as const

export type Breakpoint = keyof typeof BREAKPOINTS

/**
 * Z-index layers
 */
export const Z_INDEX = {
  DROPDOWN: 10,
  STICKY: 20,
  FIXED: 30,
  MODAL_BACKDROP: 40,
  MODAL: 50,
  TOOLTIP: 60,
  NOTIFICATION: 70,
  MOBILE_MENU: 80,
} as const
