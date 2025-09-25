'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface WebflowAuthButtonProps {
  userId?: string;
  className?: string;
}

export function WebflowAuthButton({ userId, className }: WebflowAuthButtonProps) {
  const [isConnected, setIsConnected] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [sites, setSites] = useState<any[]>([])
  const router = useRouter()

  useEffect(() => {
    checkWebflowConnection()
  }, [])

  const checkWebflowConnection = async () => {
    try {
      const response = await fetch('/api/auth/webflow/status')
      if (response.ok) {
        const data = await response.json()
        setIsConnected(data.connected)
        setSites(data.sites || [])
      }
    } catch (error) {
      console.error('Failed to check Webflow connection:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleConnect = () => {
    // Redirect to OAuth authorization endpoint
    window.location.href = '/api/auth/webflow/authorize'
  }

  const handleDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect from Webflow?')) {
      return
    }

    try {
      const response = await fetch('/api/auth/webflow/disconnect', {
        method: 'POST'
      })

      if (response.ok) {
        setIsConnected(false)
        setSites([])
        router.refresh()
      }
    } catch (error) {
      console.error('Failed to disconnect from Webflow:', error)
    }
  }

  if (isLoading) {
    return (
      <div className={`bg-white rounded-lg shadow p-6 ${className}`}>
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
          <div className="h-10 bg-gray-200 rounded"></div>
        </div>
      </div>
    )
  }

  return (
    <div className={`bg-white rounded-lg shadow p-6 ${className}`}>
      <h3 className="text-lg font-medium text-gray-900 mb-4">
        Webflow Integration
      </h3>

      {!isConnected ? (
        <div>
          <p className="text-sm text-gray-600 mb-4">
            Connect your Webflow account to start analyzing your sites
          </p>
          <button
            onClick={handleConnect}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 px-4 rounded-md transition-colors flex items-center justify-center"
          >
            <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
              <path d="M17 2c1.103 0 2 .897 2 2v16c0 1.103-.897 2-2 2H7c-1.103 0-2-.897-2-2V4c0-1.103.897-2 2-2h10zm0 18V4H7v16h10z"/>
              <path d="M12 6c3.309 0 6 2.691 6 6s-2.691 6-6 6-6-2.691-6-6 2.691-6 6-6zm0 10c2.206 0 4-1.794 4-4s-1.794-4-4-4-4 1.794-4 4 1.794 4 4 4z"/>
            </svg>
            Connect with Webflow
          </button>
          <p className="text-xs text-gray-500 mt-2">
            You'll be redirected to Webflow to authorize access
          </p>
        </div>
      ) : (
        <div>
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
            <div className="flex items-center">
              <svg className="w-5 h-5 text-green-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span className="text-sm font-medium text-green-800">
                Connected to Webflow
              </span>
            </div>
          </div>

          {sites.length > 0 && (
            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-2">
                Authorized sites: {sites.length}
              </p>
              <div className="space-y-1">
                {sites.slice(0, 3).map((site: any) => (
                  <div key={site.site_id} className="text-xs text-gray-500">
                    • {site.site_name}
                  </div>
                ))}
                {sites.length > 3 && (
                  <div className="text-xs text-gray-400">
                    ... and {sites.length - 3} more
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="flex space-x-3">
            <button
              onClick={() => router.push('/dashboard/analyze')}
              className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 px-4 rounded-md transition-colors text-sm"
            >
              Analyze Sites
            </button>
            <button
              onClick={handleDisconnect}
              className="bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium py-2 px-4 rounded-md transition-colors text-sm"
            >
              Disconnect
            </button>
          </div>
        </div>
      )}
    </div>
  )
}