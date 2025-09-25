# Webflow OAuth Flow Documentation

## Overview
QA Sentinel использует OAuth 2.0 Authorization Code Flow для безопасного доступа к Webflow API.

## Flow Diagram
```
User                    QA Sentinel             Webflow
 |                          |                       |
 |  Click "Connect"         |                       |
 |------------------------->|                       |
 |                          |                       |
 |                          | Generate state        |
 |                          | Redirect to Webflow   |
 |<-------------------------|                       |
 |                                                  |
 |           Authorize access                       |
 |------------------------------------------------->|
 |                                                  |
 |           Redirect with code                     |
 |<-------------------------------------------------|
 |                          |                       |
 | Callback with code       |                       |
 |------------------------->|                       |
 |                          |                       |
 |                          | Exchange code         |
 |                          |---------------------->|
 |                          |                       |
 |                          | Receive tokens        |
 |                          |<----------------------|
 |                          |                       |
 |                          | Store tokens in DB    |
 |                          | Fetch user sites      |
 |                          |                       |
 | Show success + sites     |                       |
 |<-------------------------|                       |
```

## Implementation Details

### 1. Authorization Request (`/api/auth/webflow/authorize`)
```typescript
const authUrl = new URL('https://webflow.com/oauth/authorize');
authUrl.searchParams.set('response_type', 'code');
authUrl.searchParams.set('client_id', CLIENT_ID);
authUrl.searchParams.set('scope', 'sites:read pages:read forms:read');
authUrl.searchParams.set('state', generateState());
authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
```

### 2. State Generation (CSRF Protection)
```typescript
const state = Buffer.from(JSON.stringify({
  userId: user.id,
  timestamp: Date.now(),
  random: crypto.randomBytes(16).toString('hex')
})).toString('base64');
```

### 3. Token Exchange (`/api/auth/webflow/callback`)
```typescript
const response = await fetch('https://api.webflow.com/oauth/access_token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    code: authorizationCode,
    grant_type: 'authorization_code',
    redirect_uri: REDIRECT_URI
  })
});
```

### 4. Token Storage
Tokens are stored in Supabase with:
- User association
- Expiration tracking
- Refresh token (if provided)
- Scope information

### 5. Site Synchronization
After successful OAuth:
1. Fetch all authorized sites from Webflow API
2. Store site metadata in `webflow_sites` table
3. Display connected sites to user

## Security Considerations

### State Parameter
- Prevents CSRF attacks
- Contains user ID for validation
- Includes timestamp for expiration
- Stored in HTTP-only cookie

### Token Security
- Tokens never exposed to client
- Stored encrypted in database
- Row Level Security (RLS) ensures user isolation
- Automatic cleanup of expired tokens

### Error Handling
- Invalid state: Reject with security error
- Expired authorization code: Prompt re-authorization
- Missing scopes: Request additional permissions
- Network errors: Graceful fallback with retry

## API Endpoints Used

### Webflow OAuth Endpoints
- `GET https://webflow.com/oauth/authorize` - Start OAuth flow
- `POST https://api.webflow.com/oauth/access_token` - Exchange code for token
- `POST https://api.webflow.com/oauth/revoke` - Revoke access (not implemented yet)

### Webflow API v2 Endpoints
- `GET https://api.webflow.com/v2/sites` - List authorized sites
- `GET https://api.webflow.com/v2/sites/{site_id}/pages` - Get site pages
- `GET https://api.webflow.com/v2/sites/{site_id}/forms` - Get site forms

## Troubleshooting

### Common Issues

1. **State Mismatch**
   - Cookie not set/expired
   - User using different browser/session
   - Solution: Clear cookies and retry

2. **Invalid Redirect URI**
   - URI not whitelisted in Webflow App
   - Protocol mismatch (http vs https)
   - Solution: Check exact URI match in Webflow settings

3. **Token Exchange Failed**
   - Client secret incorrect
   - Authorization code expired (10 minutes)
   - Solution: Check credentials, retry flow

4. **No Sites Returned**
   - User didn't authorize any sites
   - API permissions insufficient
   - Solution: Re-authorize with correct scopes