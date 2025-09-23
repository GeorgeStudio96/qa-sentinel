'use client'

import { ScanResult } from '../page'

interface ScanResultsProps {
  result: ScanResult
}

export function ScanResults({ result }: ScanResultsProps) {
  const { summary, pages } = result

  const getStatusColor = (success: boolean) => {
    return success ? 'text-green-600' : 'text-red-600'
  }

  const getStatusIcon = (success: boolean) => {
    if (success) {
      return (
        <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
        </svg>
      )
    } else {
      return (
        <svg className="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
        </svg>
      )
    }
  }

  const getSeverityColor = (severity: 'low' | 'medium' | 'high') => {
    switch (severity) {
      case 'high': return 'bg-red-100 text-red-800'
      case 'medium': return 'bg-yellow-100 text-yellow-800'
      case 'low': return 'bg-blue-100 text-blue-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Scan Results</h2>
          <div className="text-sm text-gray-500">
            Completed {new Date(result.timestamp).toLocaleString()}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          <div className="text-center">
            <div className="text-3xl font-bold text-blue-600">{summary.totalPages}</div>
            <div className="text-sm text-gray-600">Pages Scanned</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-green-600">{summary.totalForms}</div>
            <div className="text-sm text-gray-600">Forms Found</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-red-600">{summary.formsWithIssues}</div>
            <div className="text-sm text-gray-600">Forms with Issues</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-gray-700">{Math.round(summary.totalDuration / 1000)}s</div>
            <div className="text-sm text-gray-600">Scan Duration</div>
          </div>
        </div>

        {/* Health Score */}
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Overall Form Health</span>
            <span className="text-sm text-gray-500">
              {summary.totalForms > 0
                ? Math.round(((summary.totalForms - summary.formsWithIssues) / summary.totalForms) * 100)
                : 100
              }%
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full ${
                summary.formsWithIssues === 0 ? 'bg-green-500' :
                summary.formsWithIssues <= summary.totalForms / 2 ? 'bg-yellow-500' : 'bg-red-500'
              }`}
              style={{
                width: `${summary.totalForms > 0
                  ? ((summary.totalForms - summary.formsWithIssues) / summary.totalForms) * 100
                  : 100
                }%`
              }}
            ></div>
          </div>
        </div>
      </div>

      {/* Page Details */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h3 className="text-xl font-semibold text-gray-900 mb-4">Page Analysis</h3>
        <div className="space-y-4">
          {pages.map((page, index) => (
            <div key={index} className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center space-x-3">
                  {getStatusIcon(page.success)}
                  <div>
                    <h4 className="font-medium text-gray-900 truncate max-w-md">{page.url}</h4>
                    <p className="text-sm text-gray-500">
                      Scanned in {Math.round(page.duration / 1000)}s
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-gray-600">
                    {page.formsCount} forms found
                  </div>
                  {page.formsWithIssues > 0 && (
                    <div className="text-sm text-red-600">
                      {page.formsWithIssues} with issues
                    </div>
                  )}
                </div>
              </div>

              {/* Form Summary for this page */}
              {page.formsCount > 0 && (
                <div className="bg-gray-50 rounded p-3 mt-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">
                      Form Analysis
                    </span>
                    <div className="flex items-center space-x-4">
                      <span className="text-sm text-green-600">
                        {page.formsCount - page.formsWithIssues} healthy
                      </span>
                      {page.formsWithIssues > 0 && (
                        <span className="text-sm text-red-600">
                          {page.formsWithIssues} need attention
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Errors */}
              {page.errors && page.errors.length > 0 && (
                <div className="mt-3">
                  <div className="text-sm font-medium text-red-700 mb-1">Errors:</div>
                  <ul className="text-sm text-red-600 space-y-1">
                    {page.errors.map((error, errorIndex) => (
                      <li key={errorIndex}>• {error}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Recommendations */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h3 className="text-xl font-semibold text-gray-900 mb-4">Recommendations</h3>
        <div className="space-y-3">
          {summary.formsWithIssues === 0 ? (
            <div className="flex items-center space-x-3 text-green-700">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span>Great job! All forms appear to be functioning correctly.</span>
            </div>
          ) : (
            <>
              <div className="flex items-center space-x-3 text-amber-700">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <span>Review and fix the {summary.formsWithIssues} forms with issues found</span>
              </div>
              <div className="ml-8 text-sm text-gray-600 space-y-1">
                <p>• Ensure all form fields have proper labels</p>
                <p>• Add required field validation</p>
                <p>• Test form submission flows</p>
                <p>• Verify accessibility compliance</p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}