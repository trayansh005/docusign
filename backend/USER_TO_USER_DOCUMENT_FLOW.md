# User-to-User Document Sending Flow

## Overview

Implemented a complete user-to-user document sending and signing workflow, similar to employer-employee DocuSign flow but designed for peer-to-peer document sharing.

## Features

### 1. **Recipients Management**

- Users can select other registered users or add email addresses
- Recipients are stored with the document template
- Each recipient has their own status tracking

### 2. **Document Assignment**

- When a user applies signatures and selects recipients, the document is assigned to those users
- Recipients appear in the "Inbox" section of their dashboard
- Documents show who sent them and any custom message

### 3. **Email Notifications**

- Automatic email notifications sent to all recipients
- Beautifully formatted HTML emails with:
  - Sender's name
  - Document name
  - Custom message (if provided)
  - Direct link to view and sign the document

### 4. **Status Tracking**

- Each recipient has a signature status: `pending`, `signed`, or `declined`
- Recipients can see their own status in the inbox
- Document senders can track who has signed

## Database Schema Changes

### DocuSignTemplate Model

Added two new fields:

#### `recipients` (Array)

```javascript
recipients: [
	{
		id: String, // Unique identifier
		name: String, // Recipient's name
		email: String, // Recipient's email (optional)
		userId: ObjectId, // Reference to User model (if registered user)
		signatureStatus: {
			// Current status: 'pending', 'signed', 'declined'
			type: String,
			enum: ["pending", "signed", "declined"],
			default: "pending",
		},
		signedAt: Date, // When they signed
		notifiedAt: Date, // When notification was sent
	},
];
```

#### `message` (Object)

```javascript
message: {
  subject: String,        // Email subject / document subject
  body: String           // Custom message to recipients
}
```

## API Changes

### POST `/api/docusign/:templateId/apply-signatures`

**Updated Request Body:**

```javascript
{
  signatures: [...],      // Signature data (existing)
  fields: [...],          // Signature fields (existing)
  viewport: {...},        // Viewport info (existing)

  // NEW: Recipients and message
  recipients: [
    {
      id: "user-id",
      name: "John Doe",
      email: "john@example.com"
    }
  ],
  message: {
    subject: "Please sign this document",
    body: "Hi, I need your signature on this important document."
  }
}
```

**Backend Processing:**

1. ✅ Enriches recipients with `userId` by matching email/ID with registered users
2. ✅ Saves recipients to template
3. ✅ Saves custom message
4. ✅ Applies signatures to PDF
5. ✅ Sends email notifications to all recipients
6. ✅ Returns success response

### GET `/api/dashboard/inbox`

**Updated Response:**

```javascript
{
  success: true,
  data: [
    {
      id: "template-id",
      name: "Document Name",
      status: "final",
      createdAt: "2025-10-14T...",
      updatedAt: "2025-10-14T...",
      finalPdfUrl: "/uploads/...",

      // NEW: Sender information
      sender: "Jane Smith",

      // NEW: Message from sender
      message: {
        subject: "Please sign this",
        body: "Custom message..."
      },

      // NEW: Recipient's own info
      myRecipientInfo: {
        signatureStatus: "pending",
        signedAt: null
      }
    }
  ]
}
```

**Query Logic:**

- Finds templates where user is a recipient (by userId, id, or email)
- Populates sender information
- Includes recipient-specific data
- Sorts by most recent

## Frontend Changes

### RecipientsManager Component

Located: `frontend/src/components/FomiqDashboard/RecipientsManager.tsx`

**Features:**

- Toggle between "Email" and "Select User" modes
- Add recipients by typing name/email
- Select from registered users with UserPicker
- Remove recipients
- Display list of selected recipients

### FinalizePanel Component

Located: `frontend/src/components/FomiqDashboard/FinalizePanel.tsx`

**Updated to send:**

- Recipients array
- Custom message (subject + body)
- Signature data

### Dashboard Inbox

Located: `frontend/src/app/dashboard/DashboardClient.tsx`

**Enhanced Display:**

- Shows sender name
- Shows document status
- Shows recipient's signature status
- Shows message subject
- Provides "View" and "Sign" buttons
- Empty state with helpful message

## Email Notification System

### NotificationService

Located: `backend/services/NotificationService.js`

**Functions:**

#### `sendDocumentNotification()`

Sends a single email notification with:

- Professional HTML template
- Gradient header
- Document information
- Custom message in styled box
- Call-to-action button
- Direct link to document

#### `notifyAllRecipients()`

Batch sends notifications to all recipients:

- Skips recipients without email
- Generates unique document URLs
- Tracks success/failure
- Returns summary statistics

### Environment Variables Required

Add to `.env`:

```bash
# Email Configuration
EMAIL_SERVICE=gmail              # or 'smtp'
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password
FRONTEND_URL=http://localhost:3000
```

## User Flow

### Sending a Document

1. **Upload Document**

   - User uploads PDF or Word document
   - System converts to PDF and stores

2. **Add Signature Fields**

   - User places signature fields on document
   - Assigns fields to recipients

3. **Select Recipients**

   - Choose registered users OR
   - Enter name and email manually
   - Add custom message

4. **Apply & Send**
   - System applies signatures
   - Saves recipients to template
   - Sends email notifications
   - Document appears in recipients' inboxes

### Receiving a Document

1. **Email Notification**

   - Recipient receives professional email
   - Clicks "View & Sign Document" button

2. **Dashboard Inbox**

   - Document appears in inbox
   - Shows sender, status, message
   - Click "Sign" to open viewer

3. **Sign Document**

   - Opens document in viewer
   - Reviews and signs
   - Submits signatures

4. **Status Update**
   - Recipient status changes to "signed"
   - Sender can see updated status

## Files Modified/Created

### Backend

1. ✅ `models/DocuSignTemplate.js` - Added recipients and message fields
2. ✅ `controllers/docusign/signature.controller.js` - Save recipients and send notifications
3. ✅ `controllers/dashboardController.js` - Enhanced inbox query
4. ✅ `services/NotificationService.js` - NEW: Email notification service

### Frontend

1. ✅ `components/FomiqDashboard/RecipientsManager.tsx` - Already existed
2. ✅ `components/FomiqDashboard/FinalizePanel.tsx` - Already sends recipients
3. ✅ `app/dashboard/DashboardClient.tsx` - Enhanced inbox display

## Testing Checklist

- [ ] Upload a document
- [ ] Add signature fields
- [ ] Select recipients (both registered users and emails)
- [ ] Add custom message
- [ ] Apply signatures
- [ ] Verify email notifications sent
- [ ] Check recipient's inbox shows document
- [ ] Verify sender information displayed
- [ ] Check message appears correctly
- [ ] Sign document as recipient
- [ ] Verify status updates to "signed"

## Future Enhancements

### Possible Improvements

1. **Reminders**: Send reminder emails to pending recipients
2. **Decline Option**: Allow recipients to decline signing
3. **Comments**: Add comment/feedback system
4. **Audit Trail**: Track all document actions
5. **Bulk Send**: Send same document to multiple recipients
6. **Templates**: Save recipient lists as templates
7. **Deadline**: Set signing deadlines
8. **SMS Notifications**: Add SMS alerts option
9. **In-app Notifications**: Real-time notifications
10. **Read Receipts**: Track when recipients view document

### Security Enhancements

1. **Access Control**: Verify recipients can only access their documents
2. **Signature Verification**: Add signature authenticity checks
3. **Document Encryption**: Encrypt sensitive documents
4. **Audit Logs**: Comprehensive logging of all actions

## Migration Notes

- Existing templates without recipients will continue to work
- New templates will have empty recipients array by default
- Inbox will show documents with or without recipients
- No data migration needed - backwards compatible

---

**Date:** October 14, 2025
**Status:** ✅ Complete and Ready for Testing
**Impact:** Full user-to-user document sending workflow implemented
