import React from 'react'
import { CheckCircle, Clock, AlertCircle, PlayCircle, Loader } from 'lucide-react'

interface StatusBadgeProps {
  status: string
  size?: 'sm' | 'md' | 'lg'
}

export default function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  const baseClasses = 'inline-flex items-center gap-1.5 rounded-full font-medium'

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-3 py-1',
    lg: 'text-base px-4 py-1.5',
  }

  const iconSize = { sm: 12, md: 14, lg: 16 }

  const statusConfig: Record<string, { classes: string; label: string; icon: React.ReactNode }> = {
    completed: {
      classes: 'bg-green-100 text-green-800',
      label: 'Completed',
      icon: <CheckCircle size={iconSize[size]} />,
    },
    queued: {
      classes: 'bg-gray-100 text-gray-700',
      label: 'Queued',
      icon: <Clock size={iconSize[size]} />,
    },
    downloading: {
      classes: 'bg-blue-100 text-blue-800',
      label: 'Downloading',
      icon: <Loader size={iconSize[size]} className="animate-spin" />,
    },
    transcribing: {
      classes: 'bg-blue-100 text-blue-800',
      label: 'Transcribing',
      icon: <Loader size={iconSize[size]} className="animate-spin" />,
    },
    detecting_ost: {
      classes: 'bg-blue-100 text-blue-800',
      label: 'Detecting OST',
      icon: <Loader size={iconSize[size]} className="animate-spin" />,
    },
    translating: {
      classes: 'bg-blue-100 text-blue-800',
      label: 'Translating',
      icon: <Loader size={iconSize[size]} className="animate-spin" />,
    },
    exporting: {
      classes: 'bg-blue-100 text-blue-800',
      label: 'Exporting',
      icon: <Loader size={iconSize[size]} className="animate-spin" />,
    },
    processing: {
      classes: 'bg-blue-100 text-blue-800',
      label: 'Processing',
      icon: <Loader size={iconSize[size]} className="animate-spin" />,
    },
    failed: {
      classes: 'bg-red-100 text-red-800',
      label: 'Failed',
      icon: <AlertCircle size={iconSize[size]} />,
    },
    cancelled: {
      classes: 'bg-gray-100 text-gray-600',
      label: 'Cancelled',
      icon: <AlertCircle size={iconSize[size]} />,
    },
    awaiting_transcription_review: {
      classes: 'bg-amber-100 text-amber-800',
      label: 'Review Transcription',
      icon: <Clock size={iconSize[size]} />,
    },
    awaiting_translation_review: {
      classes: 'bg-purple-100 text-purple-800',
      label: 'Review Translation',
      icon: <Clock size={iconSize[size]} />,
    },
    pending: {
      classes: 'bg-gray-100 text-gray-600',
      label: 'Pending',
      icon: <Clock size={iconSize[size]} />,
    },
  }

  // Fallback for unknown statuses
  const config = statusConfig[status] || {
    classes: 'bg-gray-100 text-gray-700',
    label: status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
    icon: <Clock size={iconSize[size]} />,
  }

  return (
    <span className={`${baseClasses} ${sizeClasses[size]} ${config.classes}`}>
      {config.icon}
      {config.label}
    </span>
  )
}
