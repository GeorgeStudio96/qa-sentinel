'use client'

import { useState } from 'react'
import { ScanForm } from './components/ScanForm'
import { ScanProgress } from './components/ScanProgress'
import { ScanResults } from './components/ScanResults'

export type ScanStatus = 'idle' | 'running' | 'completed' | 'error';

export interface ScanResult {
  mainUrl: string;
  summary: {
    totalPages: number;
    successfulPages: number;
    totalForms: number;
    formsWithIssues: number;
    totalDuration: number;
  };
  pages: Array<{
    url: string;
    success: boolean;
    duration: number;
    formsCount: number;
    formsWithIssues: number;
    screenshot_size: number;
    errors?: string[];
  }>;
  timestamp: number;
}

export default function ScanPage() {
  const [scanStatus, setScanStatus] = useState<ScanStatus>('idle')
  const [scanResult, setScanResult] = useState<ScanResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState({ current: 0, total: 0, currentPage: '' })

  const handleScanStart = async (url: string, options: Record<string, unknown>) => {
    setScanStatus('running')
    setError(null)
    setScanResult(null)

    // Estimate total steps for progress
    const maxPages = Number(options.maxPages) || 5
    setProgress({ current: 0, total: maxPages + 2, currentPage: 'Starting scan...' })

    try {
      setProgress({ current: 1, total: maxPages + 2, currentPage: 'Discovering pages...' })

      const response = await fetch('/api/scan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          url,
          options
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Scan failed')
      }

      setProgress({ current: maxPages + 1, total: maxPages + 2, currentPage: 'Processing results...' })

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || 'Scan failed')
      }

      setProgress({ current: maxPages + 2, total: maxPages + 2, currentPage: 'Completed!' })
      setScanResult(result.data)
      setScanStatus('completed')

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred')
      setScanStatus('error')
    }
  }

  const handleReset = () => {
    setScanStatus('idle')
    setScanResult(null)
    setError(null)
    setProgress({ current: 0, total: 0, currentPage: '' })
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto py-8 px-4">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">QA Form Scanner</h1>
          <p className="text-xl text-gray-600">
            Test your website forms automatically - find issues, validate fields, and ensure accessibility
          </p>
        </div>

        {scanStatus === 'idle' && (
          <ScanForm onScanStart={handleScanStart} />
        )}

        {scanStatus === 'running' && (
          <ScanProgress progress={progress} />
        )}

        {(scanStatus === 'completed' || scanStatus === 'error') && (
          <div className="space-y-6">
            {scanStatus === 'error' && error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
                      <span className="text-red-600 font-bold">!</span>
                    </div>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-lg font-medium text-red-800">Scan Failed</h3>
                    <p className="text-red-700">{error}</p>
                  </div>
                </div>
              </div>
            )}

            {scanStatus === 'completed' && scanResult && (
              <ScanResults result={scanResult} />
            )}

            <div className="flex justify-center">
              <button
                onClick={handleReset}
                className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                Scan Another Website
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}