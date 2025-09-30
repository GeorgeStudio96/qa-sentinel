'use client'

import { useState, useEffect } from 'react'

interface SiteInfo {
  id: string;
  displayName: string;
  shortName: string;
  domain: string;
  workspaceId: string;
  createdOn: string;
  lastUpdated: string;
  publishedOn?: string;
  customDomains: string[];
  previewUrl: string;
  timezone: string;
  locales: {
    primary: string;
    secondary: string[];
  };
}

interface AnalysisResult {
  siteInfo: SiteInfo;
  pages: any[];
  totalPages: number;
  pageUrls: string[];
  analysisStatus: 'pending' | 'in_progress' | 'completed' | 'failed';
  issues: {
    performance: any[];
    accessibility: any[];
    seo: any[];
    broken_links: any[];
  };
  metadata: {
    analyzedAt: string;
    duration: number;
    tokensUsed: number;
  };
  options: {
    includePages: boolean;
    includeForms: boolean;
    includeCollections: boolean;
    performanceChecks: boolean;
    accessibilityChecks: boolean;
    seoChecks: boolean;
  };
}

export function SiteAnalyzer() {
  const [siteToken, setSiteToken] = useState('')
  const [siteInfo, setSiteInfo] = useState<SiteInfo | null>(null)
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [validating, setValidating] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showInstructions, setShowInstructions] = useState(false)

  // Analysis options
  const [analysisOptions, setAnalysisOptions] = useState({
    includePages: true,
    includeForms: true,
    includeCollections: false,
    performanceChecks: true,
    accessibilityChecks: true,
    seoChecks: true
  })

  const validateToken = async () => {
    if (!siteToken.trim()) {
      setError('Please enter a Site Token')
      return
    }

    if (siteToken.length < 40) {
      setError('Invalid Site Token format')
      return
    }

    setValidating(true)
    setError(null)

    try {
      // Call Fastify API endpoint
      const response = await fetch('http://localhost:3001/api/webflow/validate-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ siteToken })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to validate token')
      }

      if (data.success && data.siteInfo) {
        setSiteInfo(data.siteInfo)
        setError(null)
      } else {
        setError('Invalid Site Token')
      }

    } catch (error) {
      console.error('Token validation error:', error)
      setError(error instanceof Error ? error.message : 'Failed to validate token')
      setSiteInfo(null)
    } finally {
      setValidating(false)
    }
  }

  const startAnalysis = async () => {
    if (!siteToken || !siteInfo) return

    setAnalyzing(true)
    setError(null)

    try {
      const response = await fetch('http://localhost:3001/api/webflow/analyze-site', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          siteToken,
          siteId: siteInfo.id,
          analysisOptions
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to analyze site')
      }

      if (data.success && data.analysis) {
        setAnalysisResult(data.analysis)
      } else {
        throw new Error('Analysis failed')
      }

    } catch (error) {
      console.error('Site analysis error:', error)
      setError(error instanceof Error ? error.message : 'Failed to analyze site')
    } finally {
      setAnalyzing(false)
    }
  }

  const resetForm = () => {
    setSiteToken('')
    setSiteInfo(null)
    setAnalysisResult(null)
    setError(null)
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-medium text-gray-900">Webflow Site Analysis</h3>
        <button
          onClick={() => setShowInstructions(!showInstructions)}
          className="text-sm text-blue-600 hover:text-blue-700"
        >
          {showInstructions ? 'Hide' : 'How to get Site Token?'}
        </button>
      </div>

      {showInstructions && (
        <div className="mb-6 p-4 bg-blue-50 rounded-lg">
          <h4 className="font-medium text-blue-900 mb-2">How to get your Site Token:</h4>
          <ol className="text-sm text-blue-800 space-y-1">
            <li>1. Go to your <a href="https://webflow.com/dashboard" target="_blank" rel="noopener noreferrer" className="underline">Webflow Dashboard</a></li>
            <li>2. Find your site and click the ⚙️ gear icon</li>
            <li>3. In the left sidebar, select "Apps & integrations"</li>
            <li>4. Scroll to "API access" section</li>
            <li>5. Click "Generate API token"</li>
            <li>6. Name your token (e.g., "QA Sentinel")</li>
            <li>7. Choose permissions: Select "Read" for sites, forms, and CMS</li>
            <li>8. Copy the generated token and paste it below</li>
          </ol>
          <p className="text-xs text-blue-600 mt-2">
            ⚠️ Treat your token like a password. Don't share it publicly.
          </p>
        </div>
      )}

      {!siteInfo && (
        <div className="space-y-4">
          <div>
            <label htmlFor="siteToken" className="block text-sm font-medium text-gray-700 mb-2">
              Webflow Site Token
            </label>
            <div className="flex space-x-3">
              <input
                type="password"
                id="siteToken"
                value={siteToken}
                onChange={(e) => setSiteToken(e.target.value)}
                placeholder="Enter your Webflow Site Token..."
                className="flex-1 min-w-0 px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    validateToken()
                  }
                }}
              />
              <button
                onClick={validateToken}
                disabled={validating || !siteToken.trim()}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
              >
                {validating ? 'Validating...' : 'Validate'}
              </button>
            </div>
          </div>

          {error && (
            <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md">
              {error}
            </div>
          )}
        </div>
      )}

      {siteInfo && !analysisResult && (
        <div className="space-y-6">
          <div className="border-t pt-4">
            <h4 className="text-sm font-medium text-gray-900 mb-3">Site Information</h4>
            <div className="bg-green-50 p-4 rounded-lg">
              <div className="flex items-center space-x-2 mb-2">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  ✅ Connected
                </span>
                <span className="text-sm font-medium text-green-900">{siteInfo.displayName}</span>
              </div>
              <div className="text-sm text-green-700 space-y-1">
                <p><strong>Domain:</strong> {siteInfo.domain}</p>
                <p><strong>Site ID:</strong> {siteInfo.id}</p>
                <p><strong>Last Updated:</strong> {new Date(siteInfo.lastUpdated).toLocaleDateString()}</p>
                {siteInfo.publishedOn && (
                  <p><strong>Published:</strong> {new Date(siteInfo.publishedOn).toLocaleDateString()}</p>
                )}
              </div>
            </div>
          </div>

          <div>
            <h4 className="text-sm font-medium text-gray-900 mb-3">Analysis Options</h4>
            <div className="grid grid-cols-2 gap-3">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={analysisOptions.performanceChecks}
                  onChange={(e) => setAnalysisOptions(prev => ({ ...prev, performanceChecks: e.target.checked }))}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="ml-2 text-sm text-gray-700">Performance Checks</span>
              </label>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={analysisOptions.accessibilityChecks}
                  onChange={(e) => setAnalysisOptions(prev => ({ ...prev, accessibilityChecks: e.target.checked }))}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="ml-2 text-sm text-gray-700">Accessibility Checks</span>
              </label>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={analysisOptions.seoChecks}
                  onChange={(e) => setAnalysisOptions(prev => ({ ...prev, seoChecks: e.target.checked }))}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="ml-2 text-sm text-gray-700">SEO Checks</span>
              </label>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={analysisOptions.includeForms}
                  onChange={(e) => setAnalysisOptions(prev => ({ ...prev, includeForms: e.target.checked }))}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="ml-2 text-sm text-gray-700">Include Forms</span>
              </label>
            </div>
          </div>

          <div className="flex space-x-3 pt-4">
            <button
              onClick={startAnalysis}
              disabled={analyzing}
              className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-green-300 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
            >
              {analyzing ? 'Analyzing Site...' : 'Start QA Analysis'}
            </button>
            <button
              onClick={resetForm}
              className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
            >
              Reset
            </button>
          </div>
        </div>
      )}

      {analysisResult && (
        <div className="space-y-6 border-t pt-6">
          <div>
            <h4 className="text-lg font-medium text-gray-900 mb-4">Analysis Results</h4>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-blue-50 p-4 rounded-lg">
                <div className="text-2xl font-bold text-blue-900">{analysisResult.totalPages}</div>
                <div className="text-sm text-blue-700">Pages Analyzed</div>
              </div>
              <div className="bg-green-50 p-4 rounded-lg">
                <div className="text-2xl font-bold text-green-900">
                  {analysisResult.issues.performance.length +
                   analysisResult.issues.accessibility.length +
                   analysisResult.issues.seo.length +
                   analysisResult.issues.broken_links.length}
                </div>
                <div className="text-sm text-green-700">Issues Found</div>
              </div>
              <div className="bg-purple-50 p-4 rounded-lg">
                <div className="text-2xl font-bold text-purple-900">{analysisResult.metadata.tokensUsed}</div>
                <div className="text-sm text-purple-700">API Calls Made</div>
              </div>
            </div>

            <div className="bg-gray-50 p-4 rounded-lg">
              <h5 className="font-medium text-gray-900 mb-2">Analyzed URLs:</h5>
              <div className="space-y-1">
                {analysisResult.pageUrls.slice(0, 5).map((url, index) => (
                  <div key={index} className="text-sm text-gray-600">
                    <a href={url} target="_blank" rel="noopener noreferrer" className="hover:text-blue-600">
                      {url}
                    </a>
                  </div>
                ))}
                {analysisResult.pageUrls.length > 5 && (
                  <div className="text-sm text-gray-500">
                    ... and {analysisResult.pageUrls.length - 5} more pages
                  </div>
                )}
              </div>
            </div>

            <div className="text-xs text-gray-500">
              Analysis completed at {new Date(analysisResult.metadata.analyzedAt).toLocaleString()}
            </div>
          </div>

          <div className="flex space-x-3">
            <button
              onClick={() => setAnalysisResult(null)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
            >
              Run New Analysis
            </button>
            <button
              onClick={resetForm}
              className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
            >
              Use Different Site
            </button>
          </div>
        </div>
      )}

      {error && siteInfo && (
        <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md mt-4">
          {error}
        </div>
      )}
    </div>
  )
}