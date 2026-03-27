import React from 'react'
import {
  Download,
  Zap,
  CheckCircle2,
  Globe,
  FileText,
  Circle,
  Music,
} from 'lucide-react'

interface Stage {
  name: string
  icon: React.ReactNode
}

interface PipelineProgressV2Props {
  currentStage: number // 0-5
  completedStages: number[] // indices of completed stages
  failedStage?: number // index of failed stage if any
  compact?: boolean
}

export default function PipelineProgressV2({
  currentStage,
  completedStages,
  failedStage,
  compact = false,
}: PipelineProgressV2Props) {
  const stages: Stage[] = [
    { name: 'Download', icon: <Download size={20} /> },
    { name: 'Transcribe', icon: <Zap size={20} /> },
    { name: 'Review Transcription', icon: <CheckCircle2 size={20} /> },
    { name: 'OST / Translate', icon: <Globe size={20} /> },
    { name: 'Review Translation', icon: <Music size={20} /> },
    { name: 'Export', icon: <FileText size={20} /> },
  ]

  const isCompleted = (index: number) => completedStages.includes(index)
  const isCurrent = (index: number) => index === currentStage
  const isFailed = (index: number) => index === failedStage

  return (
    <div className={`${compact ? 'px-0' : 'bg-white rounded-lg border border-gray-200 p-6'}`}>
      {!compact && (
        <h3 className="text-lg font-semibold text-gray-900 mb-6">
          Processing Pipeline
        </h3>
      )}

      <div className={`flex items-center justify-between ${compact ? 'gap-2' : 'gap-4'}`}>
        {stages.map((stage, index) => {
          const isComplete = isCompleted(index)
          const isCurr = isCurrent(index)
          const isFail = isFailed(index)

          return (
            <React.Fragment key={index}>
              {/* Stage indicator */}
              <div className="flex flex-col items-center flex-1">
                <div
                  className={`relative mb-2 ${
                    compact ? 'w-10 h-10' : 'w-12 h-12'
                  } rounded-full border-2 flex items-center justify-center transition-all duration-300 ${
                    isFail
                      ? 'border-red-500 bg-red-50 text-red-600'
                      : isComplete
                        ? 'border-green-500 bg-green-50 text-green-600'
                        : isCurr
                          ? 'border-amber-400 bg-amber-50 text-amber-600'
                          : 'border-gray-300 bg-gray-50 text-gray-400'
                  }`}
                >
                  {isFail ? (
                    <span className="text-lg font-bold">!</span>
                  ) : isComplete ? (
                    <CheckCircle2 size={compact ? 18 : 24} />
                  ) : isCurr ? (
                    <div className="animate-pulse">
                      <Circle size={compact ? 18 : 24} />
                    </div>
                  ) : (
                    <Circle size={compact ? 18 : 24} />
                  )}
                </div>

                {!compact && (
                  <div className="text-center w-full">
                    <p
                      className={`text-sm font-medium transition-colors duration-300 ${
                        isFail
                          ? 'text-red-600'
                          : isComplete
                            ? 'text-green-600'
                            : isCurr
                              ? 'text-amber-600'
                              : 'text-gray-500'
                      }`}
                    >
                      {stage.name}
                    </p>
                    {isCurr && (
                      <p className="text-xs text-amber-600 font-medium mt-1">
                        In progress
                      </p>
                    )}
                    {isFail && (
                      <p className="text-xs text-red-600 font-medium mt-1">
                        Failed
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Connecting line */}
              {index < stages.length - 1 && (
                <div
                  className={`flex-grow h-1 rounded-full ${
                    isComplete ? 'bg-green-500' : 'bg-gray-300'
                  } transition-colors duration-300 ${compact ? 'mx-1' : 'mx-2'}`}
                  style={{
                    minWidth: compact ? '8px' : '24px',
                  }}
                />
              )}
            </React.Fragment>
          )
        })}
      </div>

      {!compact && (
        <div className="mt-6 pt-6 border-t border-gray-200">
          <div className="grid grid-cols-6 gap-2">
            {stages.map((stage, index) => {
              const isComplete = isCompleted(index)
              const isCurr = isCurrent(index)
              const isFail = isFailed(index)

              return (
                <div
                  key={index}
                  className="flex flex-col items-center p-2 rounded-lg bg-gray-50"
                >
                  <div
                    className={`text-gray-600 mb-1 transition-colors duration-300 ${
                      isFail
                        ? 'text-red-600'
                        : isComplete
                          ? 'text-green-600'
                          : isCurr
                            ? 'text-amber-600'
                            : 'text-gray-400'
                    }`}
                  >
                    {stage.icon}
                  </div>
                  <p className="text-xs text-center text-gray-700 font-medium leading-tight">
                    {stage.name}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {isComplete
                      ? '✓ Done'
                      : isCurr
                        ? 'In progress'
                        : isFail
                          ? 'Failed'
                          : 'Waiting'}
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
