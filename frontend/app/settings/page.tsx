'use client'

export const dynamic = 'force-dynamic'

import React, { useEffect, useState } from 'react'
import axios from 'axios'
import {
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  Loader,
  Eye,
  EyeOff,
  Copy,
  Check,
} from 'lucide-react'

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'down'
  redis?: {
    status: 'connected' | 'disconnected'
    latency_ms?: number
  }
  database?: {
    status: 'connected' | 'disconnected'
    latency_ms?: number
  }
  workers?: {
    active: number
    idle: number
  }
  version?: string
}

export default function SettingsPage() {
  const [health, setHealth] = useState<HealthStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [apiKey, setApiKey] = useState('')
  const [showApiKey, setShowApiKey] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const fetchHealth = async () => {
      try {
        setLoading(true)
        const response = await axios.get('/api/health')
        setHealth(response.data)
        setError('')
      } catch (err) {
        console.error('Failed to fetch health status:', err)
        setError('Failed to load system health information')
      } finally {
        setLoading(false)
      }
    }

    fetchHealth()

    // Refresh health status every 30 seconds
    const interval = setInterval(fetchHealth, 30000)
    return () => clearInterval(interval)
  }, [])

  const handleCopyApiKey = () => {
    navigator.clipboard.writeText(apiKey)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'connected':
      case 'healthy':
        return <CheckCircle2 className="text-green-600" size={20} />
      case 'disconnected':
      case 'degraded':
        return <AlertTriangle className="text-yellow-600" size={20} />
      case 'down':
        return <AlertCircle className="text-red-600" size={20} />
      default:
        return <AlertCircle className="text-gray-400" size={20} />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected':
      case 'healthy':
        return 'text-green-700 bg-green-50'
      case 'disconnected':
      case 'degraded':
        return 'text-yellow-700 bg-yellow-50'
      case 'down':
        return 'text-red-700 bg-red-50'
      default:
        return 'text-gray-700 bg-gray-50'
    }
  }

  return (
    <div className="flex-1 overflow-auto">
      <div className="p-6 lg:p-8 max-w-4xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Settings</h1>
          <p className="text-gray-600">
            Configure and monitor the VoxTranslate system
          </p>
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

        {/* API Configuration */}
        <div className="card p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            API Configuration
          </h2>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              API Endpoint
            </label>
            <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg border border-gray-200">
              <code className="flex-1 text-sm text-gray-700">
                http://localhost:8000
              </code>
              <span className="px-3 py-1 bg-green-100 text-green-800 rounded text-xs font-medium">
                Connected
              </span>
            </div>
          </div>

          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              API Key (if required)
            </label>
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <input
                  type={showApiKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Enter API key here (not stored locally)"
                  className="input-field pr-10"
                />
                <button
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showApiKey ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              <button
                onClick={handleCopyApiKey}
                disabled={!apiKey}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {copied ? <Check size={18} /> : <Copy size={18} />}
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              API keys are never stored. This is for temporary testing only.
            </p>
          </div>
        </div>

        {/* System Health */}
        <div className="card p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            System Health
          </h2>

          {loading ? (
            <div className="flex items-center justify-center p-8">
              <Loader className="animate-spin text-accent mr-3" size={24} />
              <p className="text-gray-600">Loading system status...</p>
            </div>
          ) : health ? (
            <div className="space-y-4">
              {/* Overall status */}
              <div className={`p-4 rounded-lg border ${getStatusColor(health.status)}`}>
                <div className="flex items-center gap-3">
                  {getStatusIcon(health.status)}
                  <div className="flex-1">
                    <p className="font-semibold">Overall Status</p>
                    <p className="text-sm">
                      {health.status === 'healthy'
                        ? 'All systems operational'
                        : health.status === 'degraded'
                          ? 'Some systems experiencing issues'
                          : 'Systems are down'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Version info */}
              {health.version && (
                <div className="p-4 rounded-lg border border-gray-200 bg-gray-50">
                  <p className="text-sm text-gray-600">
                    API Version: <span className="font-mono font-semibold">{health.version}</span>
                  </p>
                </div>
              )}

              {/* Redis status */}
              {health.redis && (
                <div className={`p-4 rounded-lg border ${getStatusColor(health.redis.status)}`}>
                  <div className="flex items-start gap-3">
                    {getStatusIcon(health.redis.status)}
                    <div className="flex-1">
                      <p className="font-semibold">Redis Cache</p>
                      <p className="text-sm capitalize mt-1">{health.redis.status}</p>
                      {health.redis.latency_ms !== undefined && (
                        <p className="text-xs text-gray-600 mt-1">
                          Latency: {health.redis.latency_ms}ms
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Database status */}
              {health.database && (
                <div className={`p-4 rounded-lg border ${getStatusColor(health.database.status)}`}>
                  <div className="flex items-start gap-3">
                    {getStatusIcon(health.database.status)}
                    <div className="flex-1">
                      <p className="font-semibold">Database</p>
                      <p className="text-sm capitalize mt-1">{health.database.status}</p>
                      {health.database.latency_ms !== undefined && (
                        <p className="text-xs text-gray-600 mt-1">
                          Latency: {health.database.latency_ms}ms
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Workers status */}
              {health.workers && (
                <div className="p-4 rounded-lg border border-gray-200 bg-gray-50">
                  <p className="font-semibold mb-3">Active Workers</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-600">Active</p>
                      <p className="text-2xl font-bold text-accent">
                        {health.workers.active}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Idle</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {health.workers.idle}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Auto-refresh info */}
              <div className="p-4 rounded-lg border border-gray-200 bg-blue-50 flex items-start gap-3">
                <AlertCircle className="text-blue-600 flex-shrink-0 mt-0.5" size={18} />
                <p className="text-sm text-blue-800">
                  System health is automatically refreshed every 30 seconds.
                </p>
              </div>
            </div>
          ) : (
            <div className="p-8 text-center">
              <AlertCircle className="mx-auto text-red-500 mb-4" size={48} />
              <p className="text-gray-600">Unable to load system health</p>
            </div>
          )}
        </div>

        {/* Info section */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="card p-4">
            <h3 className="font-semibold text-gray-900 mb-2">Support</h3>
            <p className="text-sm text-gray-600 mb-3">
              For issues or support, contact the VoxTranslate team.
            </p>
            <a
              href="mailto:support@voxtranslate.local"
              className="text-accent hover:text-accent-dark font-medium text-sm"
            >
              support@voxtranslate.local
            </a>
          </div>

          <div className="card p-4">
            <h3 className="font-semibold text-gray-900 mb-2">Documentation</h3>
            <p className="text-sm text-gray-600 mb-3">
              Learn more about the VoxTranslate API and features.
            </p>
            <a
              href="#"
              className="text-accent hover:text-accent-dark font-medium text-sm"
            >
              API Documentation
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
