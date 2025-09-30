# Webflow Forms API - Limitations & Capabilities

## Overview
This document outlines the complete capabilities and limitations of the Webflow Forms API based on official SDK types and real-world testing.

## ✅ Available via Forms API

### Form Information
- `id` - Unique form identifier
- `displayName` - Form name displayed on site
- `pageId` - ID of page containing the form
- `pageName` - Human-readable page name
- `formElementId` - Unique form element ID
- `siteId` - Site ID containing the form
- `workspaceId` - Workspace ID
- `createdOn` - Form creation date
- `lastUpdated` - Last modification date

### Field Information
Each field in `fields` object contains:
- `displayName` - Field label/name
- `type` - Field type (see below)
- `placeholder` - Placeholder text
- `userVisible` - Whether field is visible to users

### Supported Field Types
Based on SDK `FormFieldValueType`:
- `Plain` - Text input
- `Email` - Email input
- `Password` - Password input
- `Phone` - Phone number input
- `Number` - Numeric input
- `Checkbox` - Checkbox field
- `FileUpload` - File upload field (observed in testing)

### Response Settings
- `redirectMethod` - GET or POST redirect method
- `sendEmailConfirmation` - Email confirmation enabled/disabled

## ❌ NOT Available via Forms API

### Validation Rules
- **Required fields** - No `required` or `isRequired` property
- **Pattern validation** - No regex patterns
- **Min/max length** - No length constraints
- **Custom validation** - No custom validation rules
- **Field dependencies** - No conditional logic

### Security Features
- **reCAPTCHA status** - Cannot detect if reCAPTCHA is enabled
- **Honeypot fields** - No honeypot field detection
- **Rate limiting** - No submission rate limit info
- **CSRF tokens** - No token information

### Accessibility Features
- **ARIA labels** - No accessibility attributes
- **Field descriptions** - No help text/descriptions
- **Error messages** - No custom error messages
- **Success messages** - No success message content

### Advanced Field Properties
- **Autocomplete settings** - No autocomplete attributes
- **Input masks** - No formatting masks
- **Default values** - No default/initial values
- **Field order** - No position/order information

## Impact on Testing Strategy

### Fast API-Based Checks (~100ms)
✅ Can verify:
- Email field presence
- Field count and types
- Basic form structure
- Form metadata

### Browser-Based Testing Required (~5s)
Required for:
- Required field validation
- Form submission behavior
- reCAPTCHA verification
- Actual validation rules
- Error handling
- Success/failure flows

## Example API Response

```json
{
  "id": "form123",
  "displayName": "Contact Form",
  "pageName": "Contact",
  "fields": {
    "field1": {
      "displayName": "Email",
      "type": "Email",
      "placeholder": "your@email.com",
      "userVisible": true
    },
    "field2": {
      "displayName": "Name",
      "type": "Plain",
      "placeholder": "Your Name",
      "userVisible": true
    }
  },
  "responseSettings": {
    "redirectMethod": "GET",
    "sendEmailConfirmation": false
  }
}
```

## Recommendations

1. **Hybrid Testing Approach**
   - Use API for quick structural checks
   - Use browser automation for validation testing

2. **Known Limitations Handling**
   - Document which checks are API-only
   - Clearly mark browser-required tests
   - Set appropriate user expectations

3. **Future Improvements**
   - Monitor Webflow API updates for new capabilities
   - Consider caching browser test results
   - Build heuristics for common patterns

## References
- Webflow API SDK: `webflow-api` npm package
- API Version: v2 (v1 deprecated March 2025)
- Last Updated: January 2025