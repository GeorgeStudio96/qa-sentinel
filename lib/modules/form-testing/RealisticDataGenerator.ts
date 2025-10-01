/**
 * Realistic Data Generator for Form Testing
 * Generates predefined test data presets (1 simple + 5 realistic)
 */

import type { TestDataPreset, PresetData } from './types';

export class RealisticDataGenerator {
  /**
   * Generate default presets for a user
   */
  static generateDefaultPresets(userId: string): TestDataPreset[] {
    return [
      this.createSimplePreset(userId),
      ...this.createRealisticPresets(userId),
    ];
  }

  /**
   * Create simple test preset
   */
  private static createSimplePreset(userId: string): TestDataPreset {
    return {
      userId,
      presetType: 'simple',
      presetName: 'Simple Test',
      presetData: {
        name: 'Test User',
        email: 'test@example.com',
        phone: '+1234567890',
        company: 'Test Company',
        message: 'This is a test message',
      },
      isActive: true,
    };
  }

  /**
   * Create 5 realistic test presets
   */
  private static createRealisticPresets(userId: string): TestDataPreset[] {
    const presets: TestDataPreset[] = [
      {
        userId,
        presetType: 'realistic',
        presetName: 'Tech Startup CEO',
        presetData: {
          name: 'Sarah Chen',
          email: 'sarah.chen@techvista.io',
          phone: '+1-415-555-0142',
          company: 'TechVista Inc.',
          position: 'CEO & Founder',
          website: 'https://techvista.io',
          linkedin: 'linkedin.com/in/sarahchen',
          message: 'Hi, I\'m interested in exploring how your solution could help us scale our customer onboarding process. We\'re currently handling about 500 new users per week and looking for automation opportunities. Would love to schedule a demo to discuss further.',
          budget: '$50,000 - $100,000',
          timeline: 'Q2 2025',
          industry: 'Technology',
          employees: '50-200',
        },
        isActive: true,
      },
      {
        userId,
        presetType: 'realistic',
        presetName: 'Marketing Manager',
        presetData: {
          name: 'Michael Rodriguez',
          email: 'm.rodriguez@brightwave.com',
          phone: '+1-212-555-0198',
          company: 'BrightWave Marketing',
          position: 'Senior Marketing Manager',
          website: 'www.brightwave.com',
          message: 'Hello! We\'re planning a major campaign launch in March and need support with analytics and reporting. Our team is particularly interested in your AI-powered insights feature. Can we set up a call next week to discuss pricing and implementation timeline?',
          budget: '$25,000 - $50,000',
          timeline: 'Within 1 month',
          industry: 'Marketing & Advertising',
          currentTools: 'HubSpot, Google Analytics, Salesforce',
        },
        isActive: true,
      },
      {
        userId,
        presetType: 'realistic',
        presetName: 'Freelance Designer',
        presetData: {
          name: 'Emma Thompson',
          email: 'emma@creativestudio.design',
          phone: '+44-20-7946-0958',
          company: 'Emma Thompson Creative',
          position: 'Freelance Designer',
          website: 'creativestudio.design',
          portfolio: 'behance.net/emmathompson',
          message: 'Hi there! I came across your portfolio and I\'m really impressed with your work. I\'m working on a rebranding project for a sustainable fashion startup and think your aesthetic would be a perfect fit. The project includes logo design, brand guidelines, and website mockups. Are you available for a project starting in February? Budget is flexible for the right creative partner.',
          projectType: 'Branding & Web Design',
          timeline: 'February 2025',
        },
        isActive: true,
      },
      {
        userId,
        presetType: 'realistic',
        presetName: 'E-commerce Owner',
        presetData: {
          name: 'David Kim',
          email: 'david@urbanpulse.shop',
          phone: '+1-310-555-0267',
          company: 'Urban Pulse',
          position: 'Founder & Owner',
          website: 'www.urbanpulse.shop',
          shopifyStore: 'urbanpulse.myshopify.com',
          message: 'We\'re an online streetwear brand doing around $100k/month in revenue. Looking to optimize our checkout flow and reduce cart abandonment rate (currently at 68%). Also interested in implementing personalized product recommendations. Do you have experience working with Shopify Plus stores?',
          monthlyRevenue: '$100,000',
          currentPlatform: 'Shopify Plus',
          mainGoal: 'Increase conversion rate by 15%',
          industry: 'Fashion & Retail',
        },
        isActive: true,
      },
      {
        userId,
        presetType: 'realistic',
        presetName: 'Enterprise IT Director',
        presetData: {
          name: 'Patricia Anderson',
          email: 'p.anderson@globalfinance.com',
          phone: '+1-646-555-0823',
          company: 'Global Finance Solutions',
          position: 'Director of IT Infrastructure',
          department: 'Information Technology',
          message: 'Our organization is evaluating enterprise solutions for workflow automation and need to ensure compliance with SOC 2 and GDPR requirements. We have approximately 2,500 employees across 12 locations. Looking for a solution that can integrate with our existing tech stack (Microsoft 365, ServiceNow, Okta). What does your enterprise implementation process look like, and can you provide case studies from financial services companies?',
          companySize: '2,000-5,000 employees',
          industry: 'Financial Services',
          compliance: 'SOC 2, GDPR, PCI DSS',
          budget: '$250,000+',
          timeline: 'Q3 2025',
          decisionMakers: '5-10 stakeholders',
        },
        isActive: true,
      },
    ];

    return presets;
  }

  /**
   * Get a preset by name
   */
  static getPresetByName(
    presets: TestDataPreset[],
    name: string
  ): TestDataPreset | undefined {
    return presets.find((p) => p.presetName === name);
  }

  /**
   * Generate random variation of preset data
   * Useful for creating unique submissions from the same preset
   */
  static createVariation(preset: TestDataPreset): PresetData {
    const timestamp = Date.now();
    const data = { ...preset.presetData };

    // Add timestamp to email to make it unique
    if (data.email) {
      const [localPart, domain] = data.email.split('@');
      data.email = `${localPart}+test${timestamp}@${domain}`;
    }

    return data;
  }
}
