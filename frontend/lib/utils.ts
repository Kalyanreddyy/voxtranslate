/**
 * Utility functions for the VoxTranslate frontend
 */

/**
 * Format bytes to human-readable size
 */
export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 Bytes'

  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i]
}

/**
 * Format duration from seconds to human-readable time
 */
export function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${Math.round(seconds)}s`
  }

  if (seconds < 3600) {
    const minutes = Math.round(seconds / 60)
    return `${minutes}m`
  }

  if (seconds < 86400) {
    const hours = Math.round(seconds / 3600)
    return `${hours}h`
  }

  const days = Math.round(seconds / 86400)
  return `${days}d`
}

/**
 * Format date to relative time (e.g., "2 hours ago")
 */
export function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`

  return date.toLocaleDateString()
}

/**
 * Format date to full datetime string
 */
export function formatDateTime(dateString: string): string {
  return new Date(dateString).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

/**
 * Validate YouTube URL
 */
export function isValidYouTubeUrl(url: string): boolean {
  const youtubeRegex =
    /^(https?:\/\/)?(www\.)?(youtube|youtu|youtube-nocookie)\.(com|be)\//
  return youtubeRegex.test(url.trim())
}

/**
 * Extract video ID from YouTube URL
 */
export function extractYouTubeVideoId(url: string): string | null {
  const patterns = [
    /^.*(youtu\.be\/|v\/|u\/\w\/|embed\/|watch\?v=)([^#\&\?]*).*/,
    /^.*(youtube\.com\/watch\?v=)([^#\&\?]*).*/,
  ]

  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match && match[2]) {
      return match[2]
    }
  }

  return null
}

/**
 * Classify job status for styling
 */
export type JobStatus = 'completed' | 'processing' | 'failed' | 'queued' | 'pending'

export function getStatusColor(status: JobStatus): string {
  switch (status) {
    case 'completed':
      return 'bg-green-50 border-green-200'
    case 'processing':
      return 'bg-blue-50 border-blue-200'
    case 'failed':
      return 'bg-red-50 border-red-200'
    case 'queued':
      return 'bg-yellow-50 border-yellow-200'
    case 'pending':
      return 'bg-gray-50 border-gray-200'
    default:
      return 'bg-gray-50 border-gray-200'
  }
}

/**
 * Generate a random color for avatars
 */
export function getColorFromString(str: string): string {
  const colors = [
    '#FF6B6B',
    '#4ECDC4',
    '#45B7D1',
    '#FFA07A',
    '#98D8C8',
    '#F7DC6F',
    '#BB8FCE',
    '#85C1E2',
  ]

  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash)
  }

  return colors[Math.abs(hash) % colors.length]
}

/**
 * Truncate string to max length
 */
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str
  return str.slice(0, maxLength - 3) + '...'
}

/**
 * Format number with commas
 */
export function formatNumber(num: number): string {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

/**
 * Deep clone an object
 */
export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj))
}

/**
 * Check if object is empty
 */
export function isEmpty(obj: Record<string, any>): boolean {
  return Object.keys(obj).length === 0
}

/**
 * Merge objects deeply
 */
export function deepMerge<T extends Record<string, any>>(
  target: T,
  source: Partial<T>
): T {
  const result = { ...target }

  for (const key in source) {
    if (source.hasOwnProperty(key)) {
      const sourceValue = source[key]
      const targetValue = target[key]

      if (
        typeof sourceValue === 'object' &&
        sourceValue !== null &&
        !Array.isArray(sourceValue) &&
        typeof targetValue === 'object' &&
        targetValue !== null &&
        !Array.isArray(targetValue)
      ) {
        result[key] = deepMerge(targetValue, sourceValue)
      } else {
        result[key] = sourceValue as any
      }
    }
  }

  return result
}

/**
 * Debounce function
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null

  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null
      func(...args)
    }

    if (timeout) {
      clearTimeout(timeout)
    }

    timeout = setTimeout(later, wait)
  }
}

/**
 * Throttle function
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean

  return function executedFunction(...args: Parameters<T>) {
    if (!inThrottle) {
      func(...args)
      inThrottle = true
      setTimeout(() => (inThrottle = false), limit)
    }
  }
}

/**
 * Copy to clipboard
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

/**
 * Convert file to base64
 */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = (error) => reject(error)
  })
}

/**
 * Wait for a specified duration
 */
export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Retry a function with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxAttempts: number = 3,
  initialDelay: number = 1000
): Promise<T> {
  let lastError: Error | null = null

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))

      if (attempt < maxAttempts) {
        const delay = initialDelay * Math.pow(2, attempt - 1)
        await wait(delay)
      }
    }
  }

  throw lastError
}
