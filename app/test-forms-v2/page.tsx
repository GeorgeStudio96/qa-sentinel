'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/context/AuthContext';

interface FormTestProgress {
  status: 'queued' | 'discovering' | 'testing' | 'analyzing' | 'completed' | 'failed';
  currentStep: string;
  totalSites: number;
  processedSites: number;
  totalForms: number;
  testedForms: number;
  error?: string;
}

interface FormTestResult {
  formId: string;
  formName: string;
  pageUrl: string;
  siteId: string;
  siteName: string;
  testResults: {
    hasEmailField: boolean;
    emailRequired: boolean;
    canSubmitEmpty: boolean;
    validationWorks: boolean;
    successMessageShown: boolean;
    fieldCount: number;
    requiredFieldsCount: number;
  };
  issues: Array<{
    severity: 'critical' | 'warning' | 'info';
    category: string;
    title: string;
    description: string;
    recommendation: string;
  }>;
  duration: number;
  screenshot?: string;
}

interface TestScenario {
  preset_name: string;
  preset_type: string;
}

export default function TestFormsV2Page() {
  const { user } = useAuth();
  const [testing, setTesting] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [progress, setProgress] = useState<FormTestProgress | null>(null);
  const [results, setResults] = useState<FormTestResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [realSubmission, setRealSubmission] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<string>('');
  const [scenarios, setScenarios] = useState<TestScenario[]>([]);
  const [loadingScenarios, setLoadingScenarios] = useState(false);

  // Load test scenarios on mount
  useEffect(() => {
    if (!user) return;

    const loadScenarios = async () => {
      setLoadingScenarios(true);
      console.log('Loading scenarios for user:', user.id);
      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_SERVER_URL || 'http://localhost:3001'}/api/test-scenarios/${user.id}`
        );

        console.log('Scenarios response status:', response.status);

        if (response.ok) {
          const data = await response.json();
          console.log('Scenarios loaded:', data);

          // If no scenarios exist, generate defaults
          if (!data.scenarios || data.scenarios.length === 0) {
            console.log('No scenarios found, generating defaults for user:', user.id);

            const generateResponse = await fetch(
              `${process.env.NEXT_PUBLIC_API_SERVER_URL || 'http://localhost:3001'}/api/test-scenarios/generate-defaults`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: user.id }),
              }
            );

            console.log('Generate response status:', generateResponse.status);

            if (generateResponse.ok) {
              const generateData = await generateResponse.json();
              console.log('Generated scenarios:', generateData);
              setScenarios(generateData.scenarios || []);

              if (generateData.scenarios?.length > 0) {
                setSelectedPreset(generateData.scenarios[0].preset_name);
              }
            }
            setLoadingScenarios(false);
            return;
          }

          setScenarios(data.scenarios || []);

          // Set first preset as default
          if (data.scenarios?.length > 0) {
            setSelectedPreset(data.scenarios[0].preset_name);
          }
        } else {
          // Generate default presets if none exist
          console.log('No scenarios found, generating defaults for user:', user.id);
          const generateResponse = await fetch(
            `${process.env.NEXT_PUBLIC_API_SERVER_URL || 'http://localhost:3001'}/api/test-scenarios/generate-defaults`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ userId: user.id }),
            }
          );

          console.log('Generate response status:', generateResponse.status);

          if (generateResponse.ok) {
            const generateData = await generateResponse.json();
            console.log('Generated scenarios:', generateData);
            setScenarios(generateData.scenarios || []);

            if (generateData.scenarios?.length > 0) {
              setSelectedPreset(generateData.scenarios[0].preset_name);
            }
          }
        }
      } catch (err) {
        console.error('Failed to load scenarios:', err);
      } finally {
        setLoadingScenarios(false);
      }
    };

    loadScenarios();
  }, [user]);

  // Poll for progress updates
  useEffect(() => {
    if (!jobId || !testing) return;

    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_SERVER_URL || 'http://localhost:3001'}/api/form-testing/progress/${jobId}`
        );

        if (!response.ok) {
          throw new Error('Failed to fetch progress');
        }

        const data = await response.json();
        console.log('Progress update:', data.progress);
        setProgress(data.progress);

        // Check if completed or failed
        if (data.progress.status === 'completed') {
          setResults(data.progress.results || []);
          setTesting(false);
          clearInterval(pollInterval);
        } else if (data.progress.status === 'failed') {
          setError(data.progress.error || 'Testing failed');
          setTesting(false);
          clearInterval(pollInterval);
        }
      } catch (err) {
        console.error('Error polling progress:', err);
      }
    }, 500); // Poll every 500ms for more responsive UI

    return () => clearInterval(pollInterval);
  }, [jobId, testing]);

  const runFormTesting = async () => {
    setTesting(true);
    setError(null);
    setResults(null);
    setProgress(null);
    setJobId(null);

    try {
      // Get Webflow access token from Supabase
      const tokenResponse = await fetch('/api/auth/webflow/status');
      const tokenData = await tokenResponse.json();

      if (!tokenData.connected || !tokenData.accessToken) {
        throw new Error('Webflow not connected. Please authorize first.');
      }

      // Start form testing job
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_SERVER_URL || 'http://localhost:3001'}/api/form-testing/start`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userId: user.id, // Real user ID from Supabase Auth
            accessToken: tokenData.accessToken,
            options: {
              realSubmission,
              selectedPreset: realSubmission ? selectedPreset : undefined,
            },
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to start form testing');
      }

      setJobId(data.jobId);
    } catch (err) {
      console.error('Form testing error:', err);
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
      setTesting(false);
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'text-green-700 font-semibold';
      case 'failed':
        return 'text-red-700 font-semibold';
      case 'testing':
      case 'discovering':
      case 'analyzing':
        return 'text-blue-700 font-semibold';
      case 'queued':
      default:
        return 'text-emerald-700 font-semibold';
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Authentication Required
          </h2>
          <p className="text-gray-800">Please sign in to test forms.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-7xl mx-auto px-4">
        {/* Header */}
        <div className="bg-white shadow-sm rounded-lg p-6 mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            🚀 Advanced Form Testing
          </h1>
          <p className="text-gray-800 mb-6">
            High-performance browser-based form testing with real-time progress tracking.
          </p>

          {/* Real Submission Options */}
          <div className="mb-6 space-y-4">
            <div className="flex items-center space-x-3">
              <input
                type="checkbox"
                id="realSubmission"
                checked={realSubmission}
                onChange={(e) => setRealSubmission(e.target.checked)}
                disabled={testing}
                className="h-5 w-5 text-blue-600 rounded focus:ring-blue-500"
              />
              <label htmlFor="realSubmission" className="text-gray-800 font-medium">
                Отправлять формы реально (создадутся заявки)
              </label>
            </div>

            {realSubmission && (
              <div className="ml-8 space-y-2">
                <label className="block text-sm font-medium text-gray-800">
                  Выберите пресет данных:
                </label>
                <select
                  value={selectedPreset}
                  onChange={(e) => setSelectedPreset(e.target.value)}
                  disabled={testing || loadingScenarios}
                  className="block w-full max-w-md px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                >
                  {loadingScenarios ? (
                    <option>Loading scenarios...</option>
                  ) : scenarios.length === 0 ? (
                    <option>No scenarios available</option>
                  ) : (
                    scenarios.map((scenario) => (
                      <option key={scenario.preset_name} value={scenario.preset_name}>
                        {scenario.preset_name} ({scenario.preset_type})
                      </option>
                    ))
                  )}
                </select>

                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mt-2">
                  <p className="text-sm text-yellow-800">
                    ⚠️ <strong>Внимание:</strong> При включенной опции будут создаваться реальные заявки в формах!
                  </p>
                </div>
              </div>
            )}
          </div>

          <button
            onClick={runFormTesting}
            disabled={testing || (realSubmission && !selectedPreset)}
            className={`px-6 py-3 rounded-lg font-medium transition-colors ${testing || (realSubmission && !selectedPreset)
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
              }`}
          >
            {testing ? (
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
                Testing Forms...
              </span>
            ) : (
              'Start Advanced Testing'
            )}
          </button>
        </div>

        {/* Progress Display */}
        {progress && testing && (
          <div className="bg-white shadow-sm rounded-lg p-6 mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Testing Progress
            </h3>

            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm text-gray-800 mb-2">
                  <span>{progress.currentStep}</span>
                  <span>
                    {progress.testedForms} / {progress.totalForms} forms
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{
                      width: `${progress.totalForms > 0
                          ? (progress.testedForms / progress.totalForms) * 100
                          : 0
                        }%`,
                    }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-800">Status:</span>{' '}
                  <span className={`capitalize ${getStatusColor(progress.status)}`}>
                    {progress.status}
                  </span>
                </div>
                <div>
                  <span className="text-gray-800">Sites:</span>{' '}
                  <span className="font-medium">
                    {progress.processedSites} / {progress.totalSites}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg
                  className="h-5 w-5 text-red-400"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
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

        {/* Results Display */}
        {results && results.length > 0 && (
          <div className="space-y-6">
            {/* Summary */}
            <div className="bg-white shadow-sm rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Testing Summary
              </h3>
              <div className="grid grid-cols-4 gap-4">
                <div>
                  <div className="text-sm text-gray-700">Total Forms</div>
                  <div className="text-2xl font-bold text-gray-900">
                    {results.length}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-700">Critical Issues</div>
                  <div className="text-2xl font-bold text-red-600">
                    {results.reduce(
                      (sum, r) =>
                        sum + r.issues.filter((i) => i.severity === 'critical').length,
                      0
                    )}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-700">Warnings</div>
                  <div className="text-2xl font-bold text-yellow-600">
                    {results.reduce(
                      (sum, r) =>
                        sum + r.issues.filter((i) => i.severity === 'warning').length,
                      0
                    )}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-700">Total Duration</div>
                  <div className="text-2xl font-bold text-gray-900">
                    {(results.reduce((sum, r) => sum + r.duration, 0) / 1000).toFixed(1)}s
                  </div>
                </div>
              </div>
            </div>

            {/* Forms */}
            {results.map((result, idx) => (
              <div key={idx} className="bg-white shadow-sm rounded-lg p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      {result.formName}
                    </h3>
                    <p className="text-sm text-gray-800">{result.siteName}</p>
                    <a
                      href={result.pageUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:underline"
                    >
                      {result.pageUrl}
                    </a>
                  </div>
                  <div className="text-sm text-gray-700">
                    {(result.duration / 1000).toFixed(2)}s
                  </div>
                </div>

                {/* Test Results */}
                <div className="grid grid-cols-4 gap-4 mb-4 text-sm">
                  <div>
                    <span className="text-gray-800">Fields:</span>{' '}
                    <span className="font-medium">
                      {result.testResults.fieldCount}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-800">Email:</span>{' '}
                    <span
                      className={
                        result.testResults.hasEmailField
                          ? 'text-green-600 font-medium'
                          : 'text-red-600 font-medium'
                      }
                    >
                      {result.testResults.hasEmailField ? '✓' : '✗'}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-800">Validation:</span>{' '}
                    <span
                      className={
                        result.testResults.validationWorks
                          ? 'text-green-600 font-medium'
                          : 'text-red-600 font-medium'
                      }
                    >
                      {result.testResults.validationWorks ? '✓' : '✗'}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-800">Required:</span>{' '}
                    <span className="font-medium">
                      {result.testResults.requiredFieldsCount}
                    </span>
                  </div>
                </div>

                {/* Issues */}
                {result.issues.length > 0 && (
                  <div className="space-y-2">
                    {result.issues.map((issue, issueIdx) => (
                      <div
                        key={issueIdx}
                        className={`p-3 rounded-lg border ${getSeverityColor(issue.severity)}`}
                      >
                        <div className="flex items-start">
                          <span className="mr-2">{getCategoryIcon(issue.category)}</span>
                          <div className="flex-1">
                            <div className="font-medium">{issue.title}</div>
                            <div className="text-sm mt-1">{issue.description}</div>
                            <div className="text-sm mt-2 italic">
                              💡 {issue.recommendation}
                            </div>
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
  );
}