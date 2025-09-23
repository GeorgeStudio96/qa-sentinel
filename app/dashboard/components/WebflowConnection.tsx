'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { WebflowConnection, WebflowSite } from '@/types/supabase'

interface WebflowConnectionProps {
  onConnectionChange?: () => void
}

export function WebflowConnection({ onConnectionChange }: WebflowConnectionProps) {
  const [connection, setConnection] = useState<WebflowConnection | null>(null)
  const [sites, setSites] = useState<WebflowSite[]>([])
  const [loading, setLoading] = useState(true)
  const [connecting, setConnecting] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)
  const supabase = createClient()

  const loadConnection = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Get Webflow connection
      const { data: connectionData } = await supabase
        .from('webflow_connections')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .single()

      setConnection(connectionData)

      // Get connected sites if connection exists
      if (connectionData) {
        const { data: sitesData } = await supabase
          .from('webflow_sites')
          .select('*')
          .eq('connection_id', connectionData.id)
          .eq('is_accessible', true)
          .order('display_name')

        setSites(sitesData || [])
      }
    } catch (error) {
      console.error('Error loading Webflow connection:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadConnection()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleConnect = async () => {
    setConnecting(true)
    try {
      // Redirect to OAuth authorization endpoint
      window.location.href = '/api/auth/webflow/authorize'
    } catch (error) {
      console.error('Error initiating Webflow connection:', error)
      setConnecting(false)
    }
  }

  const handleDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect Webflow? This will remove all synced sites.')) {
      return
    }

    setDisconnecting(true)
    try {
      const response = await fetch('/api/auth/webflow/disconnect', {
        method: 'POST',
      })

      if (response.ok) {
        setConnection(null)
        setSites([])
        onConnectionChange?.()
      } else {
        throw new Error('Failed to disconnect')
      }
    } catch (error) {
      console.error('Error disconnecting Webflow:', error)
      alert('Failed to disconnect Webflow. Please try again.')
    } finally {
      setDisconnecting(false)
    }
  }

  const syncSites = async () => {
    if (!connection) return

    try {
      setLoading(true)
      // This will be implemented in Task 9.4 - API Client Implementation
      // For now, just reload the connection
      await loadConnection()
    } catch (error) {
      console.error('Error syncing sites:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="h-8 bg-gray-200 rounded w-1/2"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium text-gray-900">Webflow Integration</h3>
        <div className="flex items-center space-x-2">
          {connection ? (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
              Connected
            </span>
          ) : (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
              Not Connected
            </span>
          )}
        </div>
      </div>

      {connection ? (
        <div className="space-y-4">
          <div className="text-sm text-gray-600">
            <p><strong>Email:</strong> {connection.webflow_user_email}</p>
            <p><strong>Connected:</strong> {new Date(connection.connected_at).toLocaleDateString()}</p>
            <p><strong>Sites:</strong> {sites.length} available</p>
          </div>

          {sites.length > 0 && (
            <div className="border-t pt-4">
              <h4 className="text-sm font-medium text-gray-900 mb-2">Connected Sites</h4>
              <div className="space-y-2">
                {sites.map((site) => (
                  <div
                    key={site.id}
                    className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg"
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-900">{site.display_name}</p>
                      <p className="text-xs text-gray-500">{site.domain}</p>
                    </div>
                    <div className="text-xs text-gray-400">
                      {new Date(site.synced_at).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex space-x-3 pt-4">
            <button
              onClick={syncSites}
              disabled={loading}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
            >
              {loading ? 'Syncing...' : 'Sync Sites'}
            </button>
            <button
              onClick={handleDisconnect}
              disabled={disconnecting}
              className="bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
            >
              {disconnecting ? 'Disconnecting...' : 'Disconnect'}
            </button>
          </div>
        </div>
      ) : (
        <div className="text-center py-8">
          <div className="mx-auto h-12 w-12 text-gray-400 mb-4">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
          </div>
          <h4 className="text-sm font-medium text-gray-900 mb-2">Connect to Webflow</h4>
          <p className="text-sm text-gray-500 mb-4">
            Connect your Webflow account to automatically scan and monitor your sites for quality issues.
          </p>
          <button
            onClick={handleConnect}
            disabled={connecting}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white px-6 py-2 rounded-md text-sm font-medium transition-colors"
          >
            {connecting ? 'Connecting...' : 'Connect Webflow'}
          </button>
        </div>
      )}
    </div>
  )
}