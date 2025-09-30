'use client';

import { useState, useEffect } from 'react';

interface WebflowSite {
  site_id: string;
  site_name: string;
  domain: string;
  workspace_id: string;
}

interface WebflowStatus {
  connected: boolean;
  scope?: string;
  sites?: WebflowSite[];
  expiresAt?: string;
  error?: string;
}

export default function StatusPage() {
  const [status, setStatus] = useState<WebflowStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const response = await fetch('/api/auth/webflow/status');
        const data = await response.json();
        setStatus(data);
      } catch (error) {
        console.error('Failed to fetch status:', error);
        setStatus({ connected: false, error: 'Failed to load status' });
      } finally {
        setLoading(false);
      }
    };

    fetchStatus();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading status...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-4xl mx-auto px-4">
        <div className="bg-white shadow-lg rounded-lg p-8">
          <div className="flex items-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Webflow OAuth Status</h1>
            <div className={`ml-4 px-3 py-1 rounded-full text-sm font-medium ${
              status?.connected
                ? 'bg-green-100 text-green-800'
                : 'bg-red-100 text-red-800'
            }`}>
              {status?.connected ? '✅ Connected' : '❌ Disconnected'}
            </div>
          </div>

          {status?.connected ? (
            <div className="space-y-6">
              {/* Scope Info */}
              <div className="bg-blue-50 p-4 rounded-lg">
                <h3 className="text-lg font-semibold text-blue-900 mb-2">OAuth Scope</h3>
                <p className="text-blue-700 font-mono text-sm">{status.scope}</p>
              </div>

              {/* Expiration */}
              {status.expiresAt && (
                <div className="bg-yellow-50 p-4 rounded-lg">
                  <h3 className="text-lg font-semibold text-yellow-900 mb-2">Token Expires</h3>
                  <p className="text-yellow-700">
                    {new Date(status.expiresAt).toLocaleString()}
                  </p>
                </div>
              )}

              {/* Sites List */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Authorized Sites ({status.sites?.length || 0})
                </h3>

                {status.sites && status.sites.length > 0 ? (
                  <div className="grid gap-4 md:grid-cols-2">
                    {status.sites.map((site) => (
                      <div key={site.site_id} className="bg-white p-4 rounded-lg border border-gray-200">
                        <h4 className="font-semibold text-gray-900 mb-2">{site.site_name}</h4>
                        <div className="text-sm text-gray-600 space-y-1">
                          <p><span className="font-medium">Domain:</span> {site.domain}</p>
                          <p><span className="font-medium">Site ID:</span>
                            <code className="ml-1 bg-gray-100 px-2 py-1 rounded text-xs">
                              {site.site_id}
                            </code>
                          </p>
                          <p><span className="font-medium">Workspace:</span>
                            <code className="ml-1 bg-gray-100 px-2 py-1 rounded text-xs">
                              {site.workspace_id}
                            </code>
                          </p>
                        </div>
                        <a
                          href={`https://${site.domain}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-block mt-3 text-blue-600 hover:text-blue-800 text-sm font-medium"
                        >
                          Visit Site →
                        </a>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500">No sites found</p>
                )}
              </div>

              {/* Actions */}
              <div className="flex space-x-4 pt-4 border-t border-gray-200">
                <a
                  href="/dashboard"
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition-colors"
                >
                  Go to Dashboard
                </a>
                <button
                  onClick={() => window.location.reload()}
                  className="bg-gray-600 hover:bg-gray-700 text-white px-6 py-2 rounded-lg font-medium transition-colors"
                >
                  Refresh Status
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="mb-6">
                <div className="w-16 h-16 mx-auto bg-red-100 rounded-full flex items-center justify-center mb-4">
                  <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
                <h2 className="text-xl font-semibold text-gray-900 mb-2">Not Connected to Webflow</h2>
                <p className="text-gray-600 mb-6">
                  {status?.error || 'You need to authorize access to your Webflow sites'}
                </p>
              </div>

              <a
                href="/dashboard"
                className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-lg font-medium transition-colors"
              >
                Connect to Webflow
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}