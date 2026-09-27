import { useState, useCallback } from 'react'
import { API_BASE_URL, API_ENDPOINTS, TIMEOUTS } from '../utils/config'
import type { Voice, APIError } from '../types'

export function useAPI() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<APIError | null>(null)

  const fetchWithTimeout = useCallback(
    async (endpoint: string, options?: RequestInit, timeout = TIMEOUTS.DEFAULT) => {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), timeout)

      try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
          ...options,
          signal: controller.signal
        })

        clearTimeout(timeoutId)

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || `HTTP ${response.status}`)
        }

        return await response.json()
      } catch (err) {
        const errorObj: APIError = {
          error: err instanceof Error ? err.message : 'Unknown error',
          code: 'UNKNOWN'
        }
        setError(errorObj)
        throw errorObj
      }
    },
    []
  )

  const checkHealth = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchWithTimeout(API_ENDPOINTS.HEALTH)
      setLoading(false)
      return data
    } catch (err) {
      setLoading(false)
      throw err
    }
  }, [fetchWithTimeout])

  const getConfig = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchWithTimeout(API_ENDPOINTS.CONFIG)
      setLoading(false)
      return data
    } catch (err) {
      setLoading(false)
      throw err
    }
  }, [fetchWithTimeout])

  const getStatus = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchWithTimeout(API_ENDPOINTS.STATUS)
      setLoading(false)
      return data
    } catch (err) {
      setLoading(false)
      throw err
    }
  }, [fetchWithTimeout])

  const fetchVoices = useCallback(async (): Promise<Voice[]> => {
    try {
      const response = await fetch(`${API_BASE_URL}${API_ENDPOINTS.TTS_VOICES}`)
      if (!response.ok) throw new Error('Failed to fetch voices')
      const data = await response.json()

      // Convert voice registry to Voice array
      return Object.entries(data.voice_details || {}).map(([key, value]: [string, any]) => ({
        id: key,
        gender: value.gender || 'unknown',
        age: value.age || 'adult',
        description: value.description || ''
      }))
    } catch (err) {
      console.error('Failed to fetch voices:', err)
      // Return default voices if fetch fails
      return [
        { id: 'antonio', gender: 'male', age: 'adult', description: 'Male voice' },
        { id: 'francisca', gender: 'female', age: 'adult', description: 'Female voice' },
        { id: 'brenda', gender: 'female', age: 'adult', description: 'Female voice' },
        { id: 'paulo', gender: 'male', age: 'adult', description: 'Male voice' },
        { id: 'maria', gender: 'female', age: 'adult', description: 'Female voice' }
      ]
    }
  }, [])

  return {
    loading,
    error,
    checkHealth,
    getConfig,
    getStatus,
    fetchVoices
  }
}
