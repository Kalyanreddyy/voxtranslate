import axios, { AxiosError, AxiosResponse } from 'axios'

// Create axios instance with base configuration
export const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Response interceptor for consistent error handling
apiClient.interceptors.response.use(
  (response: AxiosResponse) => response,
  (error: AxiosError) => {
    // Log error for debugging
    console.error('[API Error]', {
      status: error.response?.status,
      message: error.message,
      url: error.config?.url,
    })

    // You can add custom error handling here
    // For example: redirect to login on 401, show toast on 500, etc.

    return Promise.reject(error)
  }
)

// Request interceptor to add auth token if available
apiClient.interceptors.request.use((config) => {
  // Add API key from environment if available
  const apiKey = process.env.NEXT_PUBLIC_API_KEY
  if (apiKey) {
    config.headers.Authorization = `Bearer ${apiKey}`
  }

  return config
})

// API response types
export interface ApiResponse<T> {
  data: T
  message?: string
  status?: string
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  page_size: number
  pages: number
}

// Utility function for making authenticated requests
export const makeRequest = async <T,>(
  method: 'get' | 'post' | 'put' | 'delete' | 'patch',
  url: string,
  data?: unknown
): Promise<T> => {
  try {
    const response = await apiClient[method]<T>(url, data)
    return response.data
  } catch (error) {
    throw error
  }
}

// Convenience functions
export const api = {
  get: <T,>(url: string) => makeRequest<T>('get', url),
  post: <T,>(url: string, data: unknown) => makeRequest<T>('post', url, data),
  put: <T,>(url: string, data: unknown) => makeRequest<T>('put', url, data),
  delete: <T,>(url: string) => makeRequest<T>('delete', url),
  patch: <T,>(url: string, data: unknown) => makeRequest<T>('patch', url, data),
}

// Review/Linguist API endpoints
export interface Segment {
  start: number
  end: number
  text?: string
  translation?: string
  notes?: string
}

export interface TranscriptionReviewData {
  segments: Segment[]
}

export interface TranslationReviewData {
  segments: Array<Segment & { translation: string; notes?: string }>
  summary?: string
}

export interface User {
  username: string
  display_name: string
  role: 'admin' | 'linguist'
}

export interface TimeRange {
  start: string
  end: string
}

export interface ChunkDefinition {
  start: string
  end: string
  assign_to?: string
}

export interface ChunkJob {
  id: string
  parent_id: string
  chunk_index: number
  total_chunks: number
  time_range: TimeRange
  assigned_to?: string
  status: 'pending_review' | 'in_review' | 'approved'
  progress?: number
}

export interface JobQueue {
  jobs: any[]
  total: number
}

export const reviewApi = {
  // Transcription endpoints
  getTranscription: (jobId: string) =>
    api.get<{ segments: Segment[] }>(`/api/jobs/${jobId}/transcription`),

  submitTranscriptionReview: (jobId: string, data: TranscriptionReviewData) =>
    api.post(`/api/jobs/${jobId}/review/transcription`, data),

  skipTranscriptionReview: (jobId: string) =>
    api.post(`/api/jobs/${jobId}/skip-review/transcription`, {}),

  // Translation endpoints
  getTranslation: (jobId: string) =>
    api.get<{ segments: Segment[] }>(`/api/jobs/${jobId}/translation`),

  submitTranslationReview: (jobId: string, data: TranslationReviewData) =>
    api.post(`/api/jobs/${jobId}/review/translation`, data),

  skipTranslationReview: (jobId: string) =>
    api.post(`/api/jobs/${jobId}/skip-review/translation`, {}),

  // Job assignment
  assignJob: (jobId: string, username: string) =>
    api.post(`/api/jobs/${jobId}/assign`, { username }),

  // User management
  getUsers: () => api.get<User[]>('/api/users'),

  getUserQueue: (username: string) =>
    api.get<JobQueue>(`/api/users/${username}/queue`),

  createUser: (data: Omit<User, 'role'> & { role: 'admin' | 'linguist' }) =>
    api.post<User>('/api/users', data),

  // Job creation with time ranges
  createJob: (data: {
    youtube_url: string
    language_hint: string
    enable_ost: boolean
    time_ranges?: TimeRange[]
  }) => api.post<{ id: string }>('/api/jobs', data),

  // Chunk management
  splitJob: (jobId: string, chunks: ChunkDefinition[]) =>
    api.post<{ chunk_ids: string[] }>(`/api/jobs/${jobId}/split`, { chunks }),

  getChunks: (jobId: string) =>
    api.get<ChunkJob[]>(`/api/jobs/${jobId}/chunks`),

  mergeChunks: (jobId: string) =>
    api.post<void>(`/api/jobs/${jobId}/merge`, {}),

  reassignChunk: (jobId: string, assignTo: string) =>
    api.post<void>(`/api/jobs/${jobId}/reassign-chunk`, { assign_to: assignTo }),
}

export default apiClient
