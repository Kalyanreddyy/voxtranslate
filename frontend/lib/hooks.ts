'use client'

import { useEffect, useState } from 'react'
import axios from 'axios'

/**
 * Hook for managing async data fetching
 */
export function useFetch<T>(
  url: string,
  options?: { skip?: boolean; interval?: number }
) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(!options?.skip)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (options?.skip) return

    const fetchData = async () => {
      try {
        setLoading(true)
        const response = await axios.get<T>(url)
        setData(response.data)
        setError(null)
      } catch (err) {
        setError(
          axios.isAxiosError(err)
            ? err.response?.data?.message || err.message
            : 'An error occurred'
        )
        setData(null)
      } finally {
        setLoading(false)
      }
    }

    fetchData()

    // Set up polling if interval is specified
    if (options?.interval && options.interval > 0) {
      const intervalId = setInterval(fetchData, options.interval)
      return () => clearInterval(intervalId)
    }
  }, [url, options?.skip, options?.interval])

  return { data, loading, error }
}

/**
 * Hook for managing form submissions
 */
export function useAsync<T, E = string>(
  asyncFunction: () => Promise<T>,
  immediate = true
) {
  const [status, setStatus] = useState<'idle' | 'pending' | 'success' | 'error'>(
    'idle'
  )
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<E | null>(null)

  // The execute function wraps asyncFunction and handles setting state
  const execute = async () => {
    setStatus('pending')
    setData(null)
    setError(null)

    try {
      const response = await asyncFunction()
      setData(response)
      setStatus('success')
      return response
    } catch (err) {
      setError(err as E)
      setStatus('error')
      throw err
    }
  }

  // Call execute on mount if immediate is true
  useEffect(() => {
    if (immediate) {
      execute()
    }
  }, [immediate])

  return { execute, status, data, error }
}

/**
 * Hook for Server-Sent Events (real-time updates)
 */
export function useEventSource(
  url: string,
  options?: { skip?: boolean; onMessage?: (data: any) => void }
) {
  const [isConnected, setIsConnected] = useState(false)
  const [lastMessage, setLastMessage] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (options?.skip) return

    try {
      const eventSource = new EventSource(url)

      eventSource.onopen = () => {
        setIsConnected(true)
        setError(null)
      }

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          setLastMessage(data)
          options?.onMessage?.(data)
        } catch (err) {
          console.error('Failed to parse SSE message:', err)
        }
      }

      eventSource.onerror = () => {
        setIsConnected(false)
        setError('Connection lost')
        eventSource.close()
      }

      return () => eventSource.close()
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to connect to event source'
      )
    }
  }, [url, options?.skip])

  return { isConnected, lastMessage, error }
}

/**
 * Hook for debounced values
 */
export function useDebounce<T>(value: T, delay: number = 500): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => clearTimeout(handler)
  }, [value, delay])

  return debouncedValue
}

/**
 * Hook for managing local storage
 */
export function useLocalStorage<T>(key: string, initialValue: T) {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      if (typeof window !== 'undefined') {
        const item = window.localStorage.getItem(key)
        return item ? JSON.parse(item) : initialValue
      }
      return initialValue
    } catch (error) {
      console.error(error)
      return initialValue
    }
  })

  const setValue = (value: T | ((val: T) => T)) => {
    try {
      const valueToStore =
        value instanceof Function ? value(storedValue) : value
      setStoredValue(valueToStore)
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(key, JSON.stringify(valueToStore))
      }
    } catch (error) {
      console.error(error)
    }
  }

  return [storedValue, setValue] as const
}

/**
 * Hook for detecting if component is mounted
 */
export function useIsMounted() {
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  return isMounted
}

/**
 * Hook for managing previous value
 */
export function usePrevious<T>(value: T): T | undefined {
  const [previous, setPrevious] = useState<T>()

  useEffect(() => {
    setPrevious(value)
  }, [value])

  return previous
}
