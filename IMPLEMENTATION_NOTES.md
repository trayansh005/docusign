# Implementation Notes: Free Plan Limits & Document Notifications

## Overview
This implementation adds two key features:
1. **Free Plan Limit**: Restricts free users to signing only 2 documents per month
2. **Document Notifications**: Shows a notification bell with count for receivers who have pending documents to sign

## Changes Made

### Backend Changes

#### 1. Free Tier Limits (`backend/utils/freeTierLimits.js`)
- Updated default signing limit from 1 to 2 documents per month
- Limit is configurable via `FREE_MAX_SIGNED` environment variable

#### 2. Middleware (`backend/middleware/checkFreeTierLimit.js`)
- **New file**: Middleware to check free tier signing limits
- Checks if user has an active subscription
- If no subscription, counts documents signed in the current month
- Returns 403 error if limit exceeded with clear message
- Allows unlimited signing for users with active subscriptions

#### 3. Dashboard Controller (`backend/controllers/dashboardController.js`)
- **Updated `getUserStats`**: Modified to count only documents signed in the current month for free users
- **New endpoint `getPendingDocumentsCount`**: Returns count of pending documents for the authenticated user
  - Filters by documents where user is a recipient
  - Only counts non-completed documents
  - Matches by userId, email, or recipient ID

#### 4. Routes
- **`backend/routes/docusign.js`**: Applied `checkFreeTierSigningLimit` middleware to signing endpoints
  - `/api/docusign/:templateId/sign`
  - `/api/docusign/:templateId/apply-signatures`
- **`backend/routes/dashboard.js`**: Added new route `/api/dashboard/pending-count`

### Frontend Changes

#### 1. Notification Component (`frontend/src/components/PendingDocumentsNotification.tsx`)
- **New component**: Displays a bell icon with badge showing pending document count
- Uses React Query to fetch pending count every minute
- Only shows when user is authenticated and has pending documents
- Badge shows count (max 99+)
- Links to dashboard when clicked
- Includes tooltip with descriptive message

#### 2. Header Component (`frontend/src/app/components/Header.tsx`)
- Added `PendingDocumentsNotification` component to desktop navigation
- Added notification badge to mobile menu dashboard link
- Positioned between "Sign Document" link and user profile section

#### 3. Dashboard Client (`frontend/src/app/dashboard/DashboardClient.tsx`)
- Updated free plan banner to show "2" as the signing limit
- Added warning message when user reaches monthly signing limit
- Changed button text from "See plans" to "Upgrade Plan"

#### 4. Dashboard API Service (`frontend/src/services/dashboardAPI.ts`)
- **New file**: TypeScript service for dashboard API calls
- Includes interfaces for type safety
- Functions:
  - `getDashboardStats()`: Get user statistics
  - `getInbox()`: Get inbox items with pagination
  - `getPendingDocumentsCount()`: Get count of pending documents

## API Endpoints

### New Endpoint
```
GET /api/dashboard/pending-count
```
**Response:**
```json
{
  "success": true,
  "data": {
    "pendingCount": 3
  }
}
```

### Modified Endpoints
The following endpoints now enforce free tier limits:
- `POST /api/docusign/:templateId/sign`
- `POST /api/docusign/:templateId/apply-signatures`

**Error Response (when limit exceeded):**
```json
{
  "success": false,
  "message": "Free plan limit reached. You can only sign 2 documents per month. Please upgrade to continue.",
  "code": "FREE_TIER_LIMIT_EXCEEDED",
  "limit": 2,
  "used": 2
}
```

## Environment Variables

Add to `.env` file to customize limits:
```env
# Free tier limits
FREE_MAX_UPLOADS=1
FREE_MAX_SIGNED=2
```

## User Experience

### For Free Users:
1. Can sign up to 2 documents per month
2. Dashboard shows usage: "Document Signing: X of 2 used this month"
3. When limit reached, signing attempts return clear error message
4. Warning message appears on dashboard when limit is reached
5. "Upgrade Plan" button prominently displayed

### For All Users (Receivers):
1. Bell icon appears in header when they have pending documents
2. Badge shows count of pending documents
3. Notification updates every minute automatically
4. Clicking bell navigates to dashboard inbox
5. Mobile menu also shows notification badge

## Testing Checklist

### Free Plan Limits:
- [ ] Free user can sign first document successfully
- [ ] Free user can sign second document successfully
- [ ] Free user receives error when attempting third document in same month
- [ ] Error message is clear and actionable
- [ ] Dashboard shows correct usage count
- [ ] Warning appears when limit reached
- [ ] Premium users can sign unlimited documents
- [ ] Limit resets at start of new month

### Document Notifications:
- [ ] Bell icon appears when user has pending documents
- [ ] Badge shows correct count
- [ ] Badge updates when new documents are assigned
- [ ] Badge disappears when all documents are signed
- [ ] Clicking bell navigates to dashboard
- [ ] Notification works on both desktop and mobile
- [ ] Tooltip shows descriptive message
- [ ] Count updates automatically (every minute)

## Future Enhancements

1. **Email Notifications**: Send email when document is assigned
2. **Push Notifications**: Browser push notifications for pending documents
3. **Reminder System**: Automated reminders for unsigned documents
4. **Usage Analytics**: Track signing patterns and limits
5. **Grace Period**: Allow 1-2 extra signs with warning before hard limit
6. **Custom Limits**: Allow admins to set custom limits per user
