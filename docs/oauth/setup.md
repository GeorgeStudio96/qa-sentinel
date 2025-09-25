# Webflow OAuth Setup Guide

## Prerequisites

1. **Webflow Developer Account**
   - Register at https://developers.webflow.com
   - Create a new App

2. **App Configuration**
   - App Type: "Data Client"
   - Scopes needed: `sites:read`, `pages:read`, `forms:read`, `assets:read`

## Environment Setup

### 1. Get OAuth Credentials
- Client ID: Found in your Webflow App settings
- Client Secret: Generated when you create the app

### 2. Configure `.env.local`
```env
# Webflow OAuth
WEBFLOW_CLIENT_SECRET=your_client_secret_here

# The Client ID is hardcoded in the authorize route
```

### 3. Set Redirect URIs
Add these to your Webflow App settings:
- Development: `http://localhost:3000/api/auth/webflow/callback`
- Production: `https://your-domain.com/api/auth/webflow/callback`

## Database Setup

Run this SQL migration in Supabase:
```sql
-- Tables already created if you ran create_webflow_tables.sql
```

## Testing OAuth Flow

1. Start the development server:
```bash
npm run dev
```

2. Navigate to dashboard and click "Connect to Webflow"
3. Authorize access to your sites
4. You should see a success notification with connected sites

## Troubleshooting

### Common Issues

1. **"Invalid redirect_uri" error**
   - Make sure the redirect URI in Webflow App matches exactly
   - Include the protocol (http/https)

2. **"Invalid time value" error**
   - Fixed in latest version - expires_in now has default value

3. **State mismatch error**
   - Clear cookies and try again
   - Make sure cookies are enabled

## Security Notes

- Client Secret should never be exposed client-side
- State parameter prevents CSRF attacks
- Tokens are stored encrypted in Supabase with RLS