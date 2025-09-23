'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'

interface ConnectionNotificationProps {
  onDismiss?: () => void
}

export function ConnectionNotification({ onDismiss }: ConnectionNotificationProps) {
  const searchParams = useSearchParams()
  const [notification, setNotification] = useState<{
    type: 'success' | 'error'
    message: string
  } | null>(null)

  useEffect(() => {
    const connected = searchParams.get('connected')
    const error = searchParams.get('error')

    if (connected === 'webflow') {
      setNotification({
        type: 'success',
        message: 'Webflow connected successfully! Your sites are now being synced.'
      })
    } else if (error) {
      setNotification({
        type: 'error',
        message: `Connection failed: ${decodeURIComponent(error)}`
      })
    }

    // Auto-dismiss after 5 seconds
    const timer = setTimeout(() => {
      setNotification(null)
      onDismiss?.()
    }, 5000)

    return () => clearTimeout(timer)
  }, [searchParams, onDismiss])

  if (!notification) return null

  return (
    <div className={`rounded-md p-4 mb-6 ${
      notification.type === 'success'
        ? 'bg-green-50 border border-green-200'
        : 'bg-red-50 border border-red-200'
    }`}>
      <div className="flex">
        <div className="flex-shrink-0">
          {notification.type === 'success' ? (
            <svg className="h-5 w-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ) : (
            <svg className="h-5 w-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )}
        </div>
        <div className="ml-3">
          <p className={`text-sm font-medium ${
            notification.type === 'success' ? 'text-green-800' : 'text-red-800'
          }`}>
            {notification.message}
          </p>
        </div>
        <div className="ml-auto pl-3">
          <div className="-mx-1.5 -my-1.5">
            <button
              onClick={() => {
                setNotification(null)
                onDismiss?.()
              }}
              className={`inline-flex rounded-md p-1.5 focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                notification.type === 'success'
                  ? 'text-green-500 hover:bg-green-100 focus:ring-green-600'
                  : 'text-red-500 hover:bg-red-100 focus:ring-red-600'
              }`}
            >
              <span className="sr-only">Dismiss</span>
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}