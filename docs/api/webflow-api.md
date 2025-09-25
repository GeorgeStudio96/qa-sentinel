# Webflow API Integration Guide

## API Version
Using Webflow API v2 (latest as of 2025)

## Authentication
Bearer token authentication using OAuth access token:
```typescript
headers: {
  'Authorization': `Bearer ${accessToken}`,
  'Content-Type': 'application/json'
}
```

## Core Endpoints

### Sites Management

#### List Sites
```typescript
GET https://api.webflow.com/v2/sites
```
Returns all sites user has authorized access to.

**Response:**
```json
{
  "sites": [
    {
      "id": "site_id",
      "displayName": "My Site",
      "shortName": "my-site",
      "customDomains": ["example.com"],
      "workspaceId": "workspace_id"
    }
  ]
}
```

#### Get Site Details
```typescript
GET https://api.webflow.com/v2/sites/{site_id}
```
Returns detailed information about a specific site.

### Pages

#### List Pages
```typescript
GET https://api.webflow.com/v2/sites/{site_id}/pages
```
Returns all static pages in a site.

**Response:**
```json
{
  "pages": [
    {
      "id": "page_id",
      "title": "Home",
      "slug": "home",
      "url": "/",
      "seo": {
        "title": "Home Page",
        "description": "Welcome to our site"
      }
    }
  ]
}
```

### Forms

#### List Forms
```typescript
GET https://api.webflow.com/v2/sites/{site_id}/forms
```
Returns all forms configured in a site.

**Response:**
```json
{
  "forms": [
    {
      "id": "form_id",
      "name": "Contact Form",
      "fields": [
        {
          "name": "email",
          "type": "email",
          "required": true
        }
      ]
    }
  ]
}
```

#### Get Form Submissions
```typescript
GET https://api.webflow.com/v2/sites/{site_id}/forms/{form_id}/submissions
```
Returns form submission data (useful for testing).

### Collections (CMS)

#### List Collections
```typescript
GET https://api.webflow.com/v2/sites/{site_id}/collections
```
Returns all CMS collections in a site.

#### Get Collection Items
```typescript
GET https://api.webflow.com/v2/collections/{collection_id}/items
```
Returns items in a specific collection.

### Assets

#### List Assets
```typescript
GET https://api.webflow.com/v2/sites/{site_id}/assets
```
Returns all assets (images, documents) in a site.

## Rate Limits

Webflow API has the following rate limits:
- **60 requests per minute** for most endpoints
- **120 requests per minute** for read-only operations
- Rate limit headers:
  - `X-RateLimit-Limit`: Total allowed requests
  - `X-RateLimit-Remaining`: Requests remaining
  - `X-RateLimit-Reset`: Unix timestamp when limit resets

## Error Handling

### Common Error Codes
- `400` - Bad Request (invalid parameters)
- `401` - Unauthorized (invalid/expired token)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `429` - Too Many Requests (rate limited)
- `500` - Internal Server Error

### Error Response Format
```json
{
  "code": "validation_error",
  "message": "Invalid site_id provided",
  "details": {
    "field": "site_id",
    "issue": "not_found"
  }
}
```

## Integration Strategy

### 1. Initial Sync
When user connects via OAuth:
```typescript
async function syncUserSites(accessToken: string) {
  // 1. Fetch all sites
  const sites = await fetchSites(accessToken);

  // 2. Store in database
  await storeSites(sites);

  // 3. For each site, fetch metadata
  for (const site of sites) {
    const pages = await fetchPages(site.id, accessToken);
    const forms = await fetchForms(site.id, accessToken);
    await storeMetadata(site.id, { pages, forms });
  }
}
```

### 2. Scanning Integration
Use API data to enhance scanning:
```typescript
async function scanSite(siteId: string) {
  // 1. Get site data from API
  const site = await getSiteFromAPI(siteId);
  const pages = await getPagesFromAPI(siteId);

  // 2. Use page URLs for targeted scanning
  for (const page of pages) {
    await scanPage(site.customDomains[0] + page.url);
  }

  // 3. Validate forms against API data
  const forms = await getFormsFromAPI(siteId);
  await validateForms(forms);
}
```

### 3. Webhook Updates (Future)
```typescript
// Webhook endpoint for real-time updates
POST /api/webhooks/webflow

// Events to subscribe:
- site.publish
- form.submission
- collection.item.created
- collection.item.updated
```

## Best Practices

### 1. Caching
Cache API responses to reduce rate limit usage:
```typescript
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function getCachedSites(token: string) {
  const key = `sites:${token}`;
  const cached = cache.get(key);

  if (cached && cached.expires > Date.now()) {
    return cached.data;
  }

  const sites = await fetchSites(token);
  cache.set(key, {
    data: sites,
    expires: Date.now() + CACHE_TTL
  });

  return sites;
}
```

### 2. Batch Operations
Minimize API calls by batching:
```typescript
// Instead of fetching one by one
for (const siteId of siteIds) {
  await fetchSite(siteId); // Bad: N requests
}

// Fetch all at once
const sites = await fetchSites(); // Good: 1 request
const needed = sites.filter(s => siteIds.includes(s.id));
```

### 3. Error Recovery
Implement exponential backoff for rate limits:
```typescript
async function apiCallWithRetry(fn: Function, maxRetries = 3) {
  let lastError;

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (error.status === 429) {
        const delay = Math.pow(2, i) * 1000;
        await sleep(delay);
        continue;
      }

      throw error;
    }
  }

  throw lastError;
}
```

## Testing

### Mock Responses
For development without hitting API:
```typescript
const MOCK_SITES = [
  {
    id: 'test_site_1',
    displayName: 'Test Site',
    shortName: 'test',
    customDomains: ['test.local'],
    workspaceId: 'test_workspace'
  }
];

function getMockAPI() {
  return {
    getSites: async () => MOCK_SITES,
    getPages: async () => MOCK_PAGES,
    getForms: async () => MOCK_FORMS
  };
}
```

### Integration Tests
Test OAuth flow and API calls:
```typescript
describe('Webflow API Integration', () => {
  it('should fetch sites after OAuth', async () => {
    const token = await completeOAuthFlow();
    const sites = await fetchSites(token);
    expect(sites).toHaveLength(greaterThan(0));
  });

  it('should handle rate limits gracefully', async () => {
    // Trigger rate limit
    const promises = Array(100).fill(0).map(() => fetchSites());
    const results = await Promise.allSettled(promises);

    // Some should succeed, some should be rate limited
    const succeeded = results.filter(r => r.status === 'fulfilled');
    expect(succeeded.length).toBeGreaterThan(0);
  });
});
```