#!/usr/bin/env tsx
/**
 * Webflow Site Token Integration Test Script
 * Tests the new Site Token-based Fastify integration
 *
 * Usage: tsx scripts/test-webflow-integration.ts
 */

import { createWebflowClient, validateSiteTokenFormat } from '../lib/api/webflow/client';

async function testFastifyEndpoints() {
  console.log('🧪 Testing Fastify Webflow Endpoints...\n');

  const baseUrl = process.env.API_BASE_URL || 'http://localhost:3001';
  const siteToken = process.env.WEBFLOW_SITE_TOKEN;

  console.log(`📡 API Base URL: ${baseUrl}`);
  console.log(`🔑 Site Token: ${siteToken ? '✅ Provided' : '❌ Missing'}\n`);

  try {
    // Test health endpoint
    console.log('1. Testing Webflow health endpoint...');
    const healthResponse = await fetch(`${baseUrl}/api/webflow/health`);

    if (healthResponse.ok) {
      const healthData = await healthResponse.json();
      console.log('   ✅ Health check passed');
      console.log(`   📊 Uptime: ${healthData.uptime.toFixed(2)}s\n`);
    } else {
      console.log('   ❌ Health check failed\n');
      return;
    }

    if (!siteToken) {
      console.log('⚠️  No WEBFLOW_SITE_TOKEN provided for API testing');
      console.log('   Set WEBFLOW_SITE_TOKEN in .env.local to test API calls\n');
      console.log('📖 To get a Site Token:');
      console.log('   1. Go to https://webflow.com/dashboard');
      console.log('   2. Find your site → Settings (⚙️) → Apps & integrations');
      console.log('   3. Scroll to "API access" → Generate API token');
      console.log('   4. Name: "QA Sentinel" → Permissions: Read access');
      console.log('   5. Copy token and add to .env.local as WEBFLOW_SITE_TOKEN=your_token\n');
      return;
    }

    // Validate token format
    console.log('2. Validating Site Token format...');
    if (validateSiteTokenFormat(siteToken)) {
      console.log('   ✅ Token format is valid\n');
    } else {
      console.log('   ❌ Invalid token format\n');
      return;
    }

    // Test token validation endpoint
    console.log('3. Testing token validation endpoint...');
    const validateResponse = await fetch(`${baseUrl}/api/webflow/validate-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ siteToken })
    });

    if (validateResponse.ok) {
      const validateData = await validateResponse.json();
      if (validateData.success && validateData.siteInfo) {
        console.log('   ✅ Token validation successful');
        console.log(`   📍 Site: ${validateData.siteInfo.displayName}`);
        console.log(`   🌐 Domain: ${validateData.siteInfo.domain}`);
        console.log(`   🆔 Site ID: ${validateData.siteInfo.id}\n`);

        // Test site analysis endpoint
        console.log('4. Testing site analysis endpoint...');
        const analysisResponse = await fetch(`${baseUrl}/api/webflow/analyze-site`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            siteToken,
            siteId: validateData.siteInfo.id,
            analysisOptions: {
              includePages: true,
              includeForms: true,
              performanceChecks: true,
              accessibilityChecks: true,
              seoChecks: true
            }
          })
        });

        if (analysisResponse.ok) {
          const analysisData = await analysisResponse.json();
          if (analysisData.success && analysisData.analysis) {
            console.log('   ✅ Site analysis successful');
            console.log(`   📄 Pages found: ${analysisData.analysis.totalPages}`);
            console.log(`   🔗 URLs to analyze: ${analysisData.analysis.pageUrls.length}`);
            console.log(`   📊 Status: ${analysisData.analysis.analysisStatus}\n`);

            console.log('   📋 Sample URLs:');
            analysisData.analysis.pageUrls.slice(0, 5).forEach((url: string, index: number) => {
              console.log(`      ${index + 1}. ${url}`);
            });

            if (analysisData.analysis.pageUrls.length > 5) {
              console.log(`      ... and ${analysisData.analysis.pageUrls.length - 5} more\n`);
            } else {
              console.log('');
            }

            // Test site status endpoint
            console.log('5. Testing site status endpoint...');
            const statusResponse = await fetch(
              `${baseUrl}/api/webflow/site/${validateData.siteInfo.id}/status?token=${encodeURIComponent(siteToken)}`
            );

            if (statusResponse.ok) {
              const statusData = await statusResponse.json();
              if (statusData.success && statusData.site) {
                console.log('   ✅ Site status retrieved successfully');
                console.log(`   📊 Total pages: ${statusData.site.totalPages}`);
                console.log(`   ⏰ Last checked: ${new Date(statusData.site.lastChecked).toLocaleString()}\n`);
              }
            } else {
              console.log('   ❌ Site status request failed\n');
            }
          }
        } else {
          const analysisError = await analysisResponse.json();
          console.log(`   ❌ Site analysis failed: ${analysisError.error}\n`);
        }
      }
    } else {
      const validateError = await validateResponse.json();
      console.log(`   ❌ Token validation failed: ${validateError.error}\n`);
    }

  } catch (error) {
    console.log(`💥 Test failed: ${error instanceof Error ? error.message : 'Unknown error'}\n`);
  }
}

async function testDirectApiClient() {
  console.log('🔧 Testing Direct API Client...\n');

  const siteToken = process.env.WEBFLOW_SITE_TOKEN;

  if (!siteToken) {
    console.log('   ⚠️  No WEBFLOW_SITE_TOKEN provided - skipping direct client test\n');
    return;
  }

  try {
    const client = createWebflowClient(siteToken);

    console.log('1. Testing token validation...');
    const validation = await client.validateSiteToken();

    if (validation.valid && validation.siteInfo) {
      console.log('   ✅ Direct client validation successful');
      console.log(`   📍 Site: ${validation.siteInfo.displayName}`);
      console.log(`   🌐 Domain: ${validation.siteInfo.domain}\n`);

      console.log('2. Testing pages fetch...');
      const pages = await client.getSitePages(validation.siteInfo.id);
      console.log(`   ✅ Found ${pages.length} pages\n`);

      console.log('3. Testing URL generation...');
      const urls = await client.getPageUrls(validation.siteInfo.id);
      console.log(`   ✅ Generated ${urls.length} URLs for scanning\n`);

      if (urls.length > 0) {
        console.log('   📋 Sample URLs:');
        urls.slice(0, 3).forEach((url, index) => {
          console.log(`      ${index + 1}. ${url}`);
        });
        console.log('');
      }

    } else {
      console.log(`   ❌ Direct client validation failed: ${validation.error}\n`);
    }

  } catch (error) {
    console.log(`   💥 Direct client test failed: ${error instanceof Error ? error.message : 'Unknown error'}\n`);
  }
}

async function main() {
  console.log('🎯 Webflow Site Token Integration Test\n');
  console.log('='.repeat(50) + '\n');

  // Test Fastify endpoints
  await testFastifyEndpoints();

  console.log('='.repeat(50) + '\n');

  // Test direct API client
  await testDirectApiClient();

  console.log('='.repeat(50) + '\n');

  console.log('✅ Integration test completed!\n');

  console.log('📝 Next steps:');
  console.log('   1. Start Fastify server: npm run api:dev');
  console.log('   2. Start Next.js frontend: npm run dev');
  console.log('   3. Open http://localhost:3000/dashboard');
  console.log('   4. Use SiteAnalyzer component to test the integration\n');

  console.log('🔍 Troubleshooting:');
  console.log('   • Ensure Fastify server is running on http://localhost:3001');
  console.log('   • Check that WEBFLOW_SITE_TOKEN is valid and not expired');
  console.log('   • Verify Site Token has read permissions for sites and forms');
  console.log('   • Check network connectivity to Webflow API\n');
}

// Error handling
main().catch((error) => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});