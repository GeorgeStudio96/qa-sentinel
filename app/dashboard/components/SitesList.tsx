'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Site, Scan } from '@/types/supabase'

interface SiteWithScans extends Site {
  scans: Scan[]
}

interface SitesListProps {
  sites: SiteWithScans[]
}

export function SitesList({ sites }: SitesListProps) {
  const [scanning, setScanning] = useState<string | null>(null)
  const router = useRouter()

  const startScan = async (siteId: string) => {
    setScanning(siteId)

    try {
      const response = await fetch('/api/scan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ siteId }),
      })

      if (!response.ok) throw new Error('Failed to start scan')

      router.refresh()
    } catch (error) {
      console.error('Error starting scan:', error)
      alert('Error starting scan. Please try again.')
    } finally {
      setScanning(null)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800'
      case 'running':
        return 'bg-blue-100 text-blue-800'
      case 'failed':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  if (sites.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Your Sites</h2>
        <div className="text-center py-8">
          <p className="text-gray-500">No sites added yet. Add your first site to get started!</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-semibold mb-4">Your Sites</h2>

      <div className="space-y-4">
        {sites.map((site) => {
          const latestScan = site.scans?.[0]
          const isScanning = scanning === site.id || latestScan?.status === 'running'

          return (
            <div key={site.id} className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h3 className="font-medium text-gray-900">{site.name}</h3>
                  <p className="text-sm text-gray-500">{site.url}</p>
                </div>
                <button
                  onClick={() => startScan(site.id)}
                  disabled={isScanning}
                  className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isScanning ? 'Scanning...' : 'Start Scan'}
                </button>
              </div>

              {latestScan && (
                <div className="flex items-center space-x-4 text-sm">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(latestScan.status)}`}>
                    {latestScan.status}
                  </span>
                  <span className="text-gray-500">
                    {new Date(latestScan.started_at).toLocaleDateString()} at{' '}
                    {new Date(latestScan.started_at).toLocaleTimeString()}
                  </span>
                  {latestScan.findings_count > 0 && (
                    <span className="text-red-600 font-medium">
                      {latestScan.findings_count} issues found
                    </span>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}