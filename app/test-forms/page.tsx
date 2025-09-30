'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/context/AuthContext';

interface FormReport {
  timestamp: string;
  duration: number;
  sites: Array<{
    site: {
      displayName: string;
      domain: string;
    };
    forms: Array<{
      form: {
        displayName: string;
        pageName: string;
      };
      issues: Array<{
        category: string;
        severity: 'critical' | 'warning' | 'info';
        title: string;
        description: string;
        recommendation?: string;
      }>;
      metadata: {
        fieldCount: number;
        hasEmailField: boolean;
        hasRequiredFields: boolean;
      };
    }>;
    summary: {
      totalForms: number;
      criticalIssues: number;
      warnings: number;
      recommendations: number;
    };
  }>;
  overallSummary: {
    totalSites: number;
    totalForms: number;
    totalIssues: number;
    issuesBySeverity: Record<string, number>;
  };
}

export default function TestFormsPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<FormReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runFormDiscovery = async () => {
    setLoading(true);
    setError(null);
    setReport(null);

    try {
      const response = await fetch('/api/form-checker/discover', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          options: {
            checkSecurity: true,
            checkAccessibility: true,
            includeRecommendations: true,
          },
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to run form discovery');
      }

      setReport(data.report);
    } catch (err) {
      console.error('Form discovery error:', err);
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'warning':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'info':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'missing-fields':
        return '📝';
      case 'validation':
        return '✓';
      case 'security':
        return '🔒';
      case 'accessibility':
        return '♿';
      case 'best-practices':
        return '💡';
      default:
        return '📋';
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Authentication Required</h2>
          <p className="text-gray-600">Please sign in to test form discovery.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-7xl mx-auto px-4">
        {/* Header */}
        <div className="bg-white shadow-sm rounded-lg p-6 mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">🧪 Form Discovery Test</h1>
          <p className="text-gray-600 mb-6">
            Test the FormChecker module by analyzing forms across your connected Webflow sites.
          </p>

          <button
            onClick={runFormDiscovery}
            disabled={loading}
            className={`px-6 py-3 rounded-lg font-medium transition-colors ${
              loading
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
          >
            {loading ? (
              <span className="flex items-center">
                <svg className="animate-spin h-5 w-5 mr-3" viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Analyzing Forms...
              </span>
            ) : (
              'Analyze All Forms'
            )}
          </button>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">Error</h3>
                <div className="mt-2 text-sm text-red-700">{error}</div>
              </div>
            </div>
          </div>
        )}

        {/* Report Display */}
        {report && (
          <div className="space-y-6">
            {/* Summary Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white p-4 rounded-lg shadow-sm">
                <div className="text-sm text-gray-500">Total Sites</div>
                <div className="text-2xl font-bold text-gray-900">{report.overallSummary.totalSites}</div>
              </div>
              <div className="bg-white p-4 rounded-lg shadow-sm">
                <div className="text-sm text-gray-500">Total Forms</div>
                <div className="text-2xl font-bold text-gray-900">{report.overallSummary.totalForms}</div>
              </div>
              <div className="bg-white p-4 rounded-lg shadow-sm">
                <div className="text-sm text-gray-500">Total Issues</div>
                <div className="text-2xl font-bold text-gray-900">{report.overallSummary.totalIssues}</div>
              </div>
              <div className="bg-white p-4 rounded-lg shadow-sm">
                <div className="text-sm text-gray-500">Analysis Time</div>
                <div className="text-2xl font-bold text-gray-900">{report.duration}ms</div>
              </div>
            </div>

            {/* Issues by Severity */}
            {report.overallSummary.issuesBySeverity && (
              <div className="bg-white p-6 rounded-lg shadow-sm">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Issues by Severity</h3>
                <div className="flex space-x-4">
                  {Object.entries(report.overallSummary.issuesBySeverity).map(([severity, count]) => (
                    <div key={severity} className={`px-4 py-2 rounded-lg border ${getSeverityColor(severity)}`}>
                      <span className="font-medium capitalize">{severity}:</span> {count}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Site Results */}
            {report.sites.map((site, siteIdx) => (
              <div key={siteIdx} className="bg-white rounded-lg shadow-sm overflow-hidden">
                <div className="bg-gray-50 px-6 py-4 border-b">
                  <h2 className="text-xl font-semibold text-gray-900">{site.site.displayName}</h2>
                  <p className="text-sm text-gray-600 mt-1">{site.site.domain}</p>
                  <div className="flex space-x-4 mt-2 text-sm">
                    <span>Forms: {site.summary.totalForms}</span>
                    <span className="text-red-600">Critical: {site.summary.criticalIssues}</span>
                    <span className="text-yellow-600">Warnings: {site.summary.warnings}</span>
                    <span className="text-blue-600">Info: {site.summary.recommendations}</span>
                  </div>
                </div>

                <div className="p-6">
                  {site.forms.length === 0 ? (
                    <p className="text-gray-500">No forms found on this site.</p>
                  ) : (
                    <div className="space-y-6">
                      {site.forms.map((formData, formIdx) => (
                        <div key={formIdx} className="border-l-4 border-gray-200 pl-4">
                          <div className="mb-3">
                            <h3 className="font-medium text-gray-900">{formData.form.displayName}</h3>
                            <p className="text-sm text-gray-600">Page: {formData.form.pageName}</p>
                            <div className="flex space-x-3 text-sm text-gray-500 mt-1">
                              <span>Fields: {formData.metadata.fieldCount}</span>
                              <span>Email: {formData.metadata.hasEmailField ? '✓' : '✗'}</span>
                              <span>Required: {formData.metadata.hasRequiredFields ? '✓' : '✗'}</span>
                            </div>
                          </div>

                          {formData.issues.length > 0 && (
                            <div className="space-y-2">
                              {formData.issues.map((issue, issueIdx) => (
                                <div
                                  key={issueIdx}
                                  className={`p-3 rounded-lg border ${getSeverityColor(issue.severity)}`}
                                >
                                  <div className="flex items-start">
                                    <span className="mr-2">{getCategoryIcon(issue.category)}</span>
                                    <div className="flex-1">
                                      <div className="font-medium">{issue.title}</div>
                                      <div className="text-sm mt-1">{issue.description}</div>
                                      {issue.recommendation && (
                                        <div className="text-sm mt-2 italic">
                                          💡 {issue.recommendation}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}