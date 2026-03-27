import React from 'react'
import { LucideIcon } from 'lucide-react'

interface StatsCardProps {
  icon: LucideIcon
  label: string
  value: string | number
  trend?: 'up' | 'down' | 'neutral'
  trendValue?: string
  loading?: boolean
  color?: 'blue' | 'green' | 'purple' | 'orange'
}

export default function StatsCard({
  icon: Icon,
  label,
  value,
  trend,
  trendValue,
  loading = false,
  color = 'blue',
}: StatsCardProps) {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    purple: 'bg-purple-50 text-purple-600',
    orange: 'bg-orange-50 text-orange-600',
  }

  const trendColors = {
    up: 'text-green-600',
    down: 'text-red-600',
    neutral: 'text-gray-600',
  }

  return (
    <div className="card p-6 hover:shadow-md transition-shadow duration-200">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm text-gray-600 font-medium mb-2">{label}</p>
          {loading ? (
            <div className="loading-skeleton h-8 w-24 mb-2" />
          ) : (
            <p className="text-3xl font-bold text-gray-900">{value}</p>
          )}

          {trend && trendValue && (
            <p className={`text-sm font-medium mt-2 ${trendColors[trend]}`}>
              {trend === 'up' && '↑ '}
              {trend === 'down' && '↓ '}
              {trendValue}
            </p>
          )}
        </div>

        <div className={`${colorClasses[color]} p-3 rounded-lg`}>
          <Icon size={24} />
        </div>
      </div>
    </div>
  )
}
