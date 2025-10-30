# Feature Summary

## 1. Free Plan Document Signing Limit

### What Changed:
- Free plan users can now sign **2 documents per month** (previously 1)
- The limit resets at the beginning of each calendar month
- Users with active subscriptions have unlimited signing

### User Interface:
```
┌─────────────────────────────────────────────────────────────┐
│ ⚠️ You are on the Free plan                    Upgrade Plan │
│ Uploads: 1 of 1 used • Document Signing: 2 of 2 used this  │
│ month                                                        │
│ ⚠️ You've reached your monthly signing limit. Upgrade to    │
│ continue signing documents.                                  │
└─────────────────────────────────────────────────────────────┘
```

### Error Message (when limit exceeded):
```json
{
  "success": false,
  "message": "Free plan limit reached. You can only sign 2 documents per month. Please upgrade to continue.",
  "code": "FREE_TIER_LIMIT_EXCEEDED",
  "limit": 2,
  "used": 2
}
```

### Technical Implementation:
- **Middleware**: `checkFreeTierSigningLimit` validates before document signing
- **Database Query**: Counts documents with `status: "final"` created in current month
- **Applied to**: Both `/sign` and `/apply-signatures` endpoints

---

## 2. Pending Documents Notification

### What Changed:
- Added a notification bell icon in the header
- Shows count of documents waiting for user's signature
- Updates automatically every minute
- Visible on both desktop and mobile

### User Interface:

#### Desktop Header:
```
┌────────────────────────────────────────────────────────────┐
│ [Logo]  Plans  Dashboard  Signing Progress  Sign Document │
│                                                             │
│         🔔 [3]  👤 John Doe  🚪                            │
│         └─ Notification bell with badge                    │
└────────────────────────────────────────────────────────────┘
```

#### Mobile Menu:
```
┌────────────────────────────┐
│ 👤 John Doe                │
│ john@example.com           │
├────────────────────────────┤
│ Plans                      │
│ Dashboard 🔔 [3]           │
│ Signing Progress           │
│ Sign Document              │
├────────────────────────────┤
│ 🚪 Sign Out                │
└────────────────────────────┘
```

### Features:
- **Badge Color**: Red background with white text
- **Max Display**: Shows "99+" for counts over 99
- **Tooltip**: "You have X document(s) waiting for your signature"
- **Click Action**: Navigates to dashboard inbox
- **Auto-refresh**: Updates every 60 seconds
- **Conditional Display**: Only shows when count > 0

### Technical Implementation:
- **Component**: `PendingDocumentsNotification.tsx`
- **API Endpoint**: `GET /api/dashboard/pending-count`
- **Query**: Filters documents where user is recipient and status ≠ "final"
- **React Query**: Automatic refetching with 1-minute interval

---

## Configuration

### Environment Variables:
```env
# Customize free tier limits
FREE_MAX_UPLOADS=1      # Max document uploads for free users
FREE_MAX_SIGNED=2       # Max document signatures per month for free users
```

### Default Values:
- Upload Limit: 1 document
- Signing Limit: 2 documents per month

---

## User Flows

### Flow 1: Free User Reaches Signing Limit
1. User signs first document → Success ✅
2. User signs second document → Success ✅
3. Dashboard shows: "Document Signing: 2 of 2 used this month"
4. Warning appears: "You've reached your monthly signing limit"
5. User attempts third signature → Error 403 ❌
6. User clicks "Upgrade Plan" → Redirected to subscription page

### Flow 2: Receiver Gets Document Notification
1. Document is sent to user for signature
2. Bell icon appears in header with badge [1]
3. User hovers over bell → Tooltip shows message
4. User clicks bell → Navigates to dashboard
5. Dashboard shows document in "Documents assigned to you" section
6. User signs document → Badge count decreases
7. When all documents signed → Bell icon disappears

---

## Benefits

### For Free Users:
- ✅ Clear visibility of usage limits
- ✅ Proactive warnings before hitting limits
- ✅ Easy upgrade path when needed
- ✅ Fair monthly allowance (2 signatures)

### For All Users:
- ✅ Never miss a document requiring signature
- ✅ Real-time notification updates
- ✅ Quick access to pending documents
- ✅ Visual indicator of workload

### For Business:
- ✅ Encourages free-to-paid conversions
- ✅ Reduces support tickets about limits
- ✅ Improves user engagement
- ✅ Better document completion rates
