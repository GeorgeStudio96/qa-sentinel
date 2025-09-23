'use client'

interface ScanProgressProps {
  progress: {
    current: number
    total: number
    currentPage: string
  }
}

export function ScanProgress({ progress }: ScanProgressProps) {
  const percentage = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0
  const estimatedTimeRemaining = progress.total > 0 && progress.current > 0
    ? Math.max(0, Math.round(((progress.total - progress.current) * 10))) // Rough estimate: 10 seconds per step
    : 60 // Initial estimate

  return (
    <div className="bg-white rounded-lg shadow-lg p-8 max-w-2xl mx-auto">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Analyzing Website Forms</h2>
        <p className="text-gray-600">Please wait while we scan your website for forms and test their functionality</p>
      </div>

      {/* Progress Circle */}
      <div className="flex items-center justify-center mb-8">
        <div className="relative">
          <svg className="w-32 h-32 transform -rotate-90" viewBox="0 0 100 100">
            {/* Background circle */}
            <circle
              cx="50"
              cy="50"
              r="40"
              fill="none"
              stroke="currentColor"
              strokeWidth="8"
              className="text-gray-200"
            />
            {/* Progress circle */}
            <circle
              cx="50"
              cy="50"
              r="40"
              fill="none"
              stroke="currentColor"
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 40}`}
              strokeDashoffset={`${2 * Math.PI * 40 * (1 - percentage / 100)}`}
              className="text-blue-600 transition-all duration-500 ease-out"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-2xl font-bold text-gray-900">{percentage}%</span>
          </div>
        </div>
      </div>

      {/* Current Status */}
      <div className="text-center mb-6">
        <p className="text-lg font-medium text-gray-900 mb-2">{progress.currentPage}</p>
        <p className="text-sm text-gray-500">
          Step {progress.current} of {progress.total}
        </p>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
        <div
          className="bg-blue-600 h-2 rounded-full transition-all duration-500 ease-out"
          style={{ width: `${percentage}%` }}
        ></div>
      </div>

      {/* Time Estimate */}
      <div className="text-center text-sm text-gray-500">
        Estimated time remaining: {estimatedTimeRemaining > 0 ? `${estimatedTimeRemaining}s` : 'Almost done!'}
      </div>

      {/* Scanning Steps Info */}
      <div className="mt-8 bg-gray-50 rounded-lg p-4">
        <h3 className="text-sm font-medium text-gray-700 mb-3">Scanning Process:</h3>
        <div className="space-y-2 text-sm text-gray-600">
          <div className={`flex items-center ${progress.current >= 1 ? 'text-green-600' : ''}`}>
            <div className={`w-4 h-4 rounded-full mr-3 ${progress.current >= 1 ? 'bg-green-500' : 'bg-gray-300'}`}>
              {progress.current >= 1 && (
                <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              )}
            </div>
            <span>Discovering internal pages</span>
          </div>
          <div className={`flex items-center ${progress.current >= 2 ? 'text-green-600' : ''}`}>
            <div className={`w-4 h-4 rounded-full mr-3 ${progress.current >= 2 ? 'bg-green-500' : 'bg-gray-300'}`}>
              {progress.current >= 2 && (
                <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              )}
            </div>
            <span>Scanning pages for forms</span>
          </div>
          <div className={`flex items-center ${progress.current >= progress.total - 1 ? 'text-green-600' : ''}`}>
            <div className={`w-4 h-4 rounded-full mr-3 ${progress.current >= progress.total - 1 ? 'bg-green-500' : 'bg-gray-300'}`}>
              {progress.current >= progress.total - 1 && (
                <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              )}
            </div>
            <span>Testing form functionality</span>
          </div>
          <div className={`flex items-center ${progress.current >= progress.total ? 'text-green-600' : ''}`}>
            <div className={`w-4 h-4 rounded-full mr-3 ${progress.current >= progress.total ? 'bg-green-500' : 'bg-gray-300'}`}>
              {progress.current >= progress.total && (
                <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              )}
            </div>
            <span>Generating report</span>
          </div>
        </div>
      </div>
    </div>
  )
}