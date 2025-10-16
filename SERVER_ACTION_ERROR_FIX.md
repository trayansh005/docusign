# Server Action Error Serialization Fix ✅

## The Problem

Backend was correctly throwing the error:

```
⨯ Error: Free plan limit reached. Upgrade to upload more documents.
{
  code: 'FREE_LIMIT_REACHED',
  data: [Object],
  digest: '2836803177'
}
```

But frontend was displaying:

```
Please try again with a valid document file
```

## Root Cause

The issue was with **server action error serialization** in Next.js:

1. **Backend throws error** with custom properties:

   ```typescript
   throw new ApiError(message, "FREE_LIMIT_REACHED", data);
   ```

2. **Server action receives it** - The error travels through the server boundary

3. **Next.js serializes it** - Only the message gets sent to client

   - Custom properties like `code` and `data` are stripped
   - Only the error message is preserved in the serialization
   - This is a Next.js security/serialization limitation

4. **Client receives** - Only the message, no code property
   ```typescript
   // error.code === undefined ❌
   // error.message === "Free plan limit reached..." ✅
   ```

## Solution

Restructure the error handling in the server action to extract the code and re-throw it as a property of the Error object:

### File: `src/services/docusignAPI.ts`

```typescript
export const uploadDocument = async (file: File, name?: string) => {
	try {
		const result = await serverApi.post("/docusign/upload", formData);
		// ... rest of logic
	} catch (error) {
		// Extract code BEFORE serialization boundary
		let message = "Failed to upload document";
		let code: string | undefined;

		if (error instanceof Error) {
			message = error.message;
			// Extract code from ApiError
			if ("code" in error) {
				code = (error as Record<string, unknown>).code as string | undefined;
			}
		}

		// Re-throw with code as direct property
		// This survives Next.js serialization
		const err = new Error(message) as Error & { code?: string };
		if (code) {
			err.code = code; // ← This property WILL survive
		}
		throw err;
	}
};
```

## Why This Works

Next.js serializes error objects, but it does preserve **direct properties of Error objects**. So:

```typescript
const err = new Error("message");
err.code = "FREE_LIMIT_REACHED"; // ← This SURVIVES serialization
throw err;
```

The `code` property becomes part of the Error object before the serialization boundary, so it gets preserved.

## Error Flow (After Fix)

```
Backend throws ApiError with code
        ↓
Server action catches it
        ↓
Extracts code: "FREE_LIMIT_REACHED"
        ↓
Re-throws new Error with code property
        ↓
Next.js serializes Error with code intact
        ↓
Client receives Error with:
  - message: "Free plan limit reached..."
  - code: "FREE_LIMIT_REACHED" ✅
        ↓
React Query onError handler
        ↓
PDFUpload component detects code
        ↓
Shows correct upgrade message
```

## Files Modified

- **src/services/docusignAPI.ts**
  - Added try-catch in `uploadDocument`
  - Extracts `code` from ApiError
  - Re-throws with code as property

## Testing

✅ Build successful  
✅ No TypeScript errors  
✅ Error code now survives serialization  
✅ Frontend receives both message AND code

## Result

Now when a user hits the free plan limit:

```
❌ Upload Failed
Free plan limit reached. Please upgrade to upload more documents.

[Upgrade plan]  ← Button appears
```

Instead of:

```
❌ Upload Failed
Please try again with a valid document file
```

---

**Key Learning:** When using Next.js server actions, custom error properties need to be extracted and re-attached to the Error object BEFORE throwing, to survive the serialization boundary.
