# Free Plan Limit Error Handling Fix ✅

## Problem

When a user without a subscription tried to upload a document, they saw a generic error message:

```
"Please try again with a valid document file"
```

Instead of the proper subscription upgrade prompt:

```
"Free plan limit reached. Please upgrade to upload more documents."
```

## Root Cause

The error handling chain had two issues:

1. **Backend Response** - The backend was correctly sending:

   ```json
   {
   	"success": false,
   	"code": "FREE_LIMIT_REACHED",
   	"message": "Free plan limit reached. Upgrade to upload more documents."
   }
   ```

2. **Frontend Error Handling** - The error object was losing the `code` property during transmission:
   - `serverApiClient` was throwing a plain `Error` object
   - React Query caught only the message string
   - The `code` property was never passed through

## Solution Implemented

### 1. Created Custom ApiError Class

**File:** `src/lib/serverApiClient.ts`

```typescript
export class ApiError extends Error {
	public code?: string;
	public data?: unknown;

	constructor(message: string, code?: string, data?: unknown) {
		super(message);
		this.code = code;
		this.data = data;
		Object.setPrototypeOf(this, ApiError.prototype);
	}
}
```

### 2. Updated Error Throwing

**File:** `src/lib/serverApiClient.ts`

When an API request fails:

```typescript
if (!response.ok) {
	const errorData = await response.json();
	// Preserve both message AND code
	throw new ApiError(
		errorData.message,
		errorData.code, // ← Pass the code through
		errorData
	);
}
```

### 3. Enhanced Error Detection

**File:** `src/components/docusign/PDFUpload.tsx`

```typescript
onError: (err: unknown) => {
	let message = "";
	let code = "";

	// Extract code from ApiError
	if (err instanceof Error) {
		message = err.message;
		if ("code" in err && typeof (err as Record<string, unknown>).code === "string") {
			code = (err as Record<string, unknown>).code as string;
		}
	}

	// Check both code AND message
	if (code === "FREE_LIMIT_REACHED" || /Free plan limit/i.test(message)) {
		setLimitError("Free plan limit reached. Please upgrade to upload more documents.");
	} else {
		setLimitError(null);
	}
};
```

## Flow After Fix

```
User uploads document (not subscribed, limit reached)
        ↓
Backend returns 403 with:
  {
    code: "FREE_LIMIT_REACHED",
    message: "Free plan limit reached..."
  }
        ↓
serverApiClient detects error
        ↓
Throws ApiError with code preserved
        ↓
React Query onError handler catches it
        ↓
Extracts code: "FREE_LIMIT_REACHED"
        ↓
Sets limitError: "Free plan limit reached. Please upgrade..."
        ↓
UI shows:
  - Red error icon
  - "Upload Failed" header
  - Subscription message
  - "Upgrade plan" button → /subscription
```

## User Experience Improvement

### Before:

```
❌ Upload Failed
Please try again with a valid document file
```

### After:

```
❌ Upload Failed
Free plan limit reached. Please upgrade to upload more documents.

[Upgrade plan] → Goes to subscription page
```

## Files Modified

1. **src/lib/serverApiClient.ts**

   - Added `ApiError` custom error class
   - Updated error throwing to preserve `code` and `data`

2. **src/components/docusign/PDFUpload.tsx**
   - Enhanced error handler to extract and check error code
   - Improved error message detection logic

## Testing

✅ Build successful - no TypeScript errors  
✅ No warnings in build output  
✅ Error handling chain verified  
✅ Code property now preserved through error boundary

## Backend References

The backend already had this code in place:

- **File:** `backend/controllers/docusign/upload.controller.js` (line 136)
- **Response:** Sends both `code` and `message`
- **Check:** Verifies free-tier upload limits

## Future Improvements (Optional)

1. Create a universal error handler hook for all API errors
2. Add error code constants to avoid string matching
3. Add telemetry to track error types
4. Add error recovery suggestions in UI

---

**Status:** ✅ Complete  
**Build:** ✅ Passing  
**Testing:** ✅ Verified
