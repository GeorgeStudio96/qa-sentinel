/**
 * Form Testing Module Types
 */

export interface FormTestRequest {
  userId: string;
  accessToken?: string;
  siteIds?: string[];
  options?: FormTestOptions;
}

export interface FormTestOptions {
  maxFormsToTest?: number;
  timeout?: number;
  testCases?: string[];
  skipSlowPages?: boolean;
  realSubmission?: boolean;
  selectedPreset?: string;
}

export interface FormTestResult {
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
    testCases: TestCase[];
  };
  issues: FormIssue[];
  screenshot?: string;
  duration: number;
  testedAt: string;
  submissionResult?: SubmissionResult;
}

export interface SubmissionResult {
  submitted: boolean;
  presetUsed?: string;
  rateLimited?: boolean;
  pauseDuration?: number;
  error?: string;
  responseStatus?: number;
}

export interface TestCase {
  name: string;
  description: string;
  passed: boolean;
  details?: string;
}

export interface FormIssue {
  severity: 'critical' | 'warning' | 'info';
  category: string;
  title: string;
  description: string;
  recommendation: string;
}

export interface FormTestProgress {
  status: 'queued' | 'discovering' | 'testing' | 'analyzing' | 'completed' | 'failed';
  currentStep: string;
  totalSites: number;
  processedSites: number;
  totalForms: number;
  testedForms: number;
  results?: FormTestResult[];
  error?: string;
}

export interface AIFormReport {
  summary: string;
  criticalIssues: string[];
  recommendations: {
    formId: string;
    formName: string;
    pageUrl: string;
    recommendations: string[];
  }[];
  overallScore: number;
}

// Test Data Presets
export interface TestDataPreset {
  id?: string;
  userId?: string;
  presetType: 'simple' | 'realistic';
  presetName: string;
  presetData: PresetData;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface PresetData {
  name?: string;
  email: string;
  phone?: string;
  company?: string;
  message?: string;
  [key: string]: string | undefined;
}