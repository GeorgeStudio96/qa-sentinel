#!/usr/bin/env tsx
/**
 * Webflow API Test Script
 * Tests the connection to Webflow API using sample credentials
 *
 * Usage: tsx scripts/test-webflow-api.ts
 */

import { WebflowApiClient } from '../lib/webflow/api-client';
import { validateWebflowCredentials } from '../lib/webflow';

async function main() {
  console.log('🔍 Testing Webflow API Integration...\n');

  // Check environment variables
  console.log('📋 Checking environment variables:');
  const hasCredentials = await validateWebflowCredentials();
  console.log(`   WEBFLOW_CLIENT_ID: ${process.env.WEBFLOW_CLIENT_ID ? '✅ Set' : '❌ Missing'}`);
  console.log(`   WEBFLOW_CLIENT_SECRET: ${process.env.WEBFLOW_CLIENT_SECRET ? '✅ Set' : '❌ Missing'}\n`);

  if (!hasCredentials) {
    console.log('❌ Missing Webflow credentials in environment variables');
    console.log('   Please set WEBFLOW_CLIENT_ID and WEBFLOW_CLIENT_SECRET in .env.local\n');
    console.log('📖 To get credentials:');
    console.log('   1. Go to https://webflow.com/dashboard');
    console.log('   2. Create a new Workspace or use existing');
    console.log('   3. Go to Workspace Settings > Apps & Integrations');
    console.log('   4. Create new App with Data Client capabilities');
    console.log('   5. Copy Client ID and Client Secret to .env.local\n');
    process.exit(1);
  }

  // Test with sample access token (user needs to provide this)
  const testAccessToken = process.env.WEBFLOW_TEST_ACCESS_TOKEN;

  if (!testAccessToken) {
    console.log('⚠️  No test access token provided');
    console.log('   To test API calls, set WEBFLOW_TEST_ACCESS_TOKEN in .env.local');
    console.log('   You can get this by completing OAuth flow in the app\n');

    console.log('✅ Basic configuration check passed!');
    console.log('   OAuth endpoints should work with current configuration\n');

    console.log('🔗 Next steps:');
    console.log('   1. Start the development server: npm run dev');
    console.log('   2. Navigate to /dashboard');
    console.log('   3. Click "Connect Webflow" to test OAuth flow');
    console.log('   4. After connecting, sites will be synced automatically\n');

    return;
  }

  // Test API client
  console.log('🧪 Testing API client with access token...\n');

  try {
    const client = new WebflowApiClient(testAccessToken);

    // Test connection
    console.log('   Testing connection...');
    const connectionTest = await client.testConnection();

    if (connectionTest.success) {
      console.log(`   ✅ Connection successful! Found ${connectionTest.sitesCount} sites\n`);

      // Test sites fetch
      console.log('   Fetching sites...');
      const sites = await client.getSites();

      console.log(`   📊 Found ${sites.length} sites:`);
      sites.forEach((site, index) => {
        console.log(`   ${index + 1}. ${site.displayName} (${site.domain})`);
        console.log(`      ID: ${site.id}`);
        console.log(`      Workspace: ${site.workspaceId}`);
        console.log(`      Created: ${new Date(site.createdOn).toLocaleDateString()}\n`);
      });

      // Test pages fetch for first site
      if (sites.length > 0) {
        const firstSite = sites[0];
        console.log(`   📄 Testing pages fetch for "${firstSite.displayName}"...`);

        try {
          const pages = await client.getPages(firstSite.id);
          console.log(`   ✅ Found ${pages.length} pages\n`);

          if (pages.length > 0) {
            console.log('   📑 Sample pages:');
            pages.slice(0, 3).forEach((page, index) => {
              console.log(`   ${index + 1}. ${page.title} (/${page.slug})`);
            });
            console.log('');
          }
        } catch (error) {
          console.log(`   ⚠️  Pages fetch failed: ${error instanceof Error ? error.message : 'Unknown error'}\n`);
        }
      }

      console.log('✅ All tests passed! Webflow API integration is working correctly.\n');

    } else {
      console.log(`   ❌ Connection failed: ${connectionTest.error}\n`);
      console.log('🔍 Possible issues:');
      console.log('   1. Invalid access token');
      console.log('   2. Token expired or revoked');
      console.log('   3. Insufficient permissions');
      console.log('   4. API rate limits\n');
    }

  } catch (error) {
    console.log(`❌ API test failed: ${error instanceof Error ? error.message : 'Unknown error'}\n`);
    console.log('🔍 Check:');
    console.log('   1. Access token format and validity');
    console.log('   2. Network connectivity');
    console.log('   3. Webflow API status\n');
  }

  console.log('🏁 Test completed!');
}

// Error handling
main().catch((error) => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});