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
    const success = searchParams.get('success')
    const error = searchParams.get('error')
    const sites = searchParams.get('sites')
    const count = searchParams.get('count')

    if (success === 'webflow_connected') {
      let message = 'Webflow connected successfully!'

      if (sites && count) {
        const siteNames = sites.split(',')
        const siteCount = parseInt(count)

        if (siteCount === 1) {
          message = `✅ Connected to Webflow! Site "${siteNames[0]}" has been authorized.`
        } else if (siteCount > 1) {
          message = `✅ Connected to Webflow! ${siteCount} sites authorized: ${siteNames.join(', ')}`
        }
      }

      setNotification({
        type: 'success',
        message
      })
    } else if (error) {
      let errorMessage = 'Connection failed'

      // Provide more user-friendly error messages
      switch(error) {
        case 'missing_parameters':
          errorMessage = 'Missing required parameters. Please try again.'
          break
        case 'state_mismatch':
          errorMessage = 'Security check failed. Please try connecting again.'
          break
        case 'unauthorized':
          errorMessage = 'Authentication failed. Please log in and try again.'
          break
        case 'configuration_missing':
          errorMessage = 'Server configuration error. Please contact support.'
          break
        case 'token_exchange_failed':
          errorMessage = 'Failed to complete authorization. Please try again.'
          break
        case 'database_error':
          errorMessage = 'Database error. Please try again later.'
          break
        default:
          errorMessage = `Connection failed: ${error}`
      }

      setNotification({
        type: 'error',
        message: errorMessage
      })
    }

    // Auto-dismiss success after 10 seconds, errors after 15 seconds
    const dismissTime = notification?.type === 'success' ? 10000 : 15000
    const timer = setTimeout(() => {
      setNotification(null)
      onDismiss?.()
    }, dismissTime)

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