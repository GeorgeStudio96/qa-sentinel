/**
 * AI Report Generator
 * Generates comprehensive AI-powered reports from form test results
 */

import { createLogger } from '../../shared/logger';
import type { FormTestResult, AIFormReport } from './types';

const logger = createLogger('ai-report-generator');

export class AIReportGenerator {
  private openaiApiKey: string;
  private openaiModel: string;
  private openaiBaseUrl: string;

  constructor() {
    this.openaiApiKey = process.env.OPENAI_API_KEY || '';
    this.openaiModel = process.env.OPENAI_MODEL || 'gpt-4o-mini';
    this.openaiBaseUrl = process.env.OPENAI_API_BASE || 'https://api.openai.com/v1';
  }

  /**
   * Generate AI report from test results
   */
  async generateReport(results: FormTestResult[]): Promise<AIFormReport> {
    logger.info(`Generating AI report for ${results.length} forms`);

    // If no API key, return basic report
    if (!this.openaiApiKey) {
      logger.warn('OpenAI API key not configured, generating basic report');
      return this.generateBasicReport(results);
    }

    try {
      // Prepare data for AI
      const summary = this.prepareSummary(results);

      // Call OpenAI API
      const aiAnalysis = await this.callOpenAI(summary, results);

      // Combine AI analysis with structured data
      return {
        summary: aiAnalysis.summary,
        criticalIssues: aiAnalysis.criticalIssues,
        recommendations: this.generateRecommendations(results),
        overallScore: this.calculateScore(results),
      };
    } catch (error) {
      logger.error('Error generating AI report:', error as Error);
      return this.generateBasicReport(results);
    }
  }

  /**
   * Prepare summary for AI
   */
  private prepareSummary(results: FormTestResult[]): string {
    const totalForms = results.length;
    const formsWithIssues = results.filter((r) => r.issues.length > 0).length;
    const criticalIssues = results.reduce(
      (sum, r) => sum + r.issues.filter((i) => i.severity === 'critical').length,
      0
    );
    const warnings = results.reduce(
      (sum, r) => sum + r.issues.filter((i) => i.severity === 'warning').length,
      0
    );

    const avgFieldCount =
      results.reduce((sum, r) => sum + r.testResults.fieldCount, 0) / totalForms;

    const formsWithEmail = results.filter(
      (r) => r.testResults.hasEmailField
    ).length;

    const formsWithValidation = results.filter(
      (r) => r.testResults.validationWorks
    ).length;

    return `
Analyzed ${totalForms} forms across ${new Set(results.map((r) => r.siteId)).size} sites.

Key Findings:
- ${formsWithIssues} forms have issues (${((formsWithIssues / totalForms) * 100).toFixed(1)}%)
- ${criticalIssues} critical issues found
- ${warnings} warnings found
- Average fields per form: ${avgFieldCount.toFixed(1)}
- ${formsWithEmail} forms have email fields (${((formsWithEmail / totalForms) * 100).toFixed(1)}%)
- ${formsWithValidation} forms have validation (${((formsWithValidation / totalForms) * 100).toFixed(1)}%)
    `.trim();
  }

  /**
   * Call OpenAI API
   */
  private async callOpenAI(
    summary: string,
    results: FormTestResult[]
  ): Promise<{ summary: string; criticalIssues: string[] }> {
    const issues = results.flatMap((r) => r.issues);
    const criticalIssues = issues.filter((i) => i.severity === 'critical');

    const prompt = `You are a QA expert analyzing form testing results.

${summary}

Critical Issues Found:
${criticalIssues.map((issue) => `- ${issue.title}: ${issue.description}`).join('\n')}

Please provide:
1. A concise executive summary (2-3 sentences) of the form quality across all sites
2. List the top 3-5 most critical issues that need immediate attention

Format your response as JSON:
{
  "summary": "Executive summary here",
  "criticalIssues": ["Issue 1", "Issue 2", ...]
}`;

    const response = await fetch(`${this.openaiBaseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.openaiApiKey}`,
      },
      body: JSON.stringify({
        model: this.openaiModel,
        messages: [
          {
            role: 'system',
            content:
              'You are a QA expert specializing in web form analysis. Provide clear, actionable insights.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content || '{}';

    // Parse JSON response
    try {
      return JSON.parse(content);
    } catch {
      // Fallback if JSON parsing fails
      return {
        summary: content,
        criticalIssues: criticalIssues.map((i) => i.title),
      };
    }
  }

  /**
   * Generate basic report without AI
   */
  private generateBasicReport(results: FormTestResult[]): AIFormReport {
    const totalForms = results.length;
    const formsWithIssues = results.filter((r) => r.issues.length > 0).length;
    const criticalIssues = results.flatMap((r) =>
      r.issues.filter((i) => i.severity === 'critical')
    );

    return {
      summary: `Analyzed ${totalForms} forms. Found ${formsWithIssues} forms with issues (${criticalIssues.length} critical).`,
      criticalIssues: criticalIssues.map(
        (i) => `${i.title}: ${i.description}`
      ),
      recommendations: this.generateRecommendations(results),
      overallScore: this.calculateScore(results),
    };
  }

  /**
   * Generate recommendations
   */
  private generateRecommendations(results: FormTestResult[]) {
    return results
      .filter((r) => r.issues.length > 0)
      .map((result) => ({
        formId: result.formId,
        formName: result.formName,
        pageUrl: result.pageUrl,
        recommendations: result.issues.map(
          (issue) => `${issue.title}: ${issue.recommendation}`
        ),
      }));
  }

  /**
   * Calculate overall quality score (0-100)
   */
  private calculateScore(results: FormTestResult[]): number {
    if (results.length === 0) return 0;

    let totalScore = 0;

    results.forEach((result) => {
      let formScore = 100;

      // Deduct points for issues
      result.issues.forEach((issue) => {
        switch (issue.severity) {
          case 'critical':
            formScore -= 20;
            break;
          case 'warning':
            formScore -= 10;
            break;
          case 'info':
            formScore -= 5;
            break;
        }
      });

      // Bonus points for good practices
      if (result.testResults.hasEmailField) formScore += 5;
      if (result.testResults.emailRequired) formScore += 5;
      if (result.testResults.validationWorks) formScore += 10;
      if (!result.testResults.canSubmitEmpty) formScore += 10;

      totalScore += Math.max(0, Math.min(100, formScore));
    });

    return Math.round(totalScore / results.length);
  }
}