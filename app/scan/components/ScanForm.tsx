'use client'

import { useState } from 'react'

interface ScanFormProps {
  onScanStart: (url: string, options: Record<string, unknown>) => void
}

export function ScanForm({ onScanStart }: ScanFormProps) {
  const [url, setUrl] = useState('')
  const [maxPages, setMaxPages] = useState(5)
  const [testSubmissions, setTestSubmissions] = useState(true)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!url) return

    setLoading(true)

    const options = {
      maxPages,
      testFormSubmissions: testSubmissions,
      timeout: 30000,
      waitUntil: 'networkidle' as const
    }

    try {
      await onScanStart(url, options)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-8 max-w-2xl mx-auto">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="url" className="block text-sm font-medium text-gray-700 mb-2">
            Website URL
          </label>
          <input
            id="url"
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-lg"
            required
          />
          <p className="text-sm text-gray-500 mt-1">
            Enter the website URL you want to scan for form issues
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label htmlFor="maxPages" className="block text-sm font-medium text-gray-700 mb-2">
              Max Pages to Scan
            </label>
            <select
              id="maxPages"
              value={maxPages}
              onChange={(e) => setMaxPages(parseInt(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value={1}>1 page</option>
              <option value={3}>3 pages</option>
              <option value={5}>5 pages</option>
              <option value={10}>10 pages</option>
            </select>
            <p className="text-sm text-gray-500 mt-1">
              Number of internal pages to discover and scan
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Test Options
            </label>
            <div className="space-y-2">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={testSubmissions}
                  onChange={(e) => setTestSubmissions(e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <span className="ml-2 text-sm text-gray-700">Test form submissions</span>
              </label>
            </div>
            <p className="text-sm text-gray-500 mt-1">
              Enable to test actual form submission behavior
            </p>
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="text-sm font-medium text-blue-800 mb-2">What we&apos;ll test:</h3>
          <ul className="text-sm text-blue-700 space-y-1">
            <li>• Form field validation and accessibility</li>
            <li>• Required field compliance</li>
            <li>• Label associations and ARIA attributes</li>
            <li>• Form submission behavior (if enabled)</li>
            <li>• Overall form usability and best practices</li>
          </ul>
        </div>

        <button
          type="submit"
          disabled={loading || !url}
          className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium text-lg transition-colors"
        >
          {loading ? (
            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
              Starting Scan...
            </div>
          ) : (
            'Start Form Analysis'
          )}
        </button>
      </form>
    </div>
  )
}