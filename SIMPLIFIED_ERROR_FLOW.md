# Simplified Error Flow - Free Plan Limit

## How It Now Works (Simplified)

### Backend Response (upload.controller.js)
```javascript
// When user has no subscription and hit limit:
return res.status(403).json({
  success: false,
  code: "FREE_LIMIT_REACHED",
  message: "Free plan limit reached. Upgrade to upload more documents."
});
```

### Frontend - Server Action (docusignAPI.ts)
```typescript
export const uploadDocument = async (file: File) => {
  const result = await serverApi.post("/docusign/upload", formData);
  
  if (!result.success) {
    // Attach the code to the error for client-side detection
    const err = new Error(result.message) as Error & { code?: string };
    if (result.code) {
      err.code = result.code;  // <- Key: code is attached here
    }
    throw err;
  }
  
  return result.data;
};
```

### Frontend - Error Handler (PDFUpload.tsx)
```typescript
onError: (err: unknown) => {
  if (err instanceof Error) {
    // Check code property
    const code = (err as unknown as Record<string, unknown>).code;
    if (code === "FREE_LIMIT_REACHED") {
      setLimitError("Free plan limit reached. Please upgrade...");
      return;
    }
    
    // Fallback to message check
    if (err.message?.includes("Free plan limit")) {
      setLimitError("Free plan limit reached. Please upgrade...");
      return;
    }
  }
  
  setLimitError(null);  // Other errors
}
```

## The Flow

```
User without subscription clicks upload
        ↓
Backend checks free tier limit
        ↓
Limit exceeded → returns 403 with code: "FREE_LIMIT_REACHED"
        ↓
docusignAPI.ts receives response
        ↓
success: false → creates Error with code attached
        ↓
React Query catches error in onError
        ↓
PDFUpload checks error.code
        ↓
code === "FREE_LIMIT_REACHED" → sets limitError state
        ↓
UI shows:
✅ Error icon
✅ "Upload Failed" 
✅ "Free plan limit reached. Please upgrade..."
✅ "Upgrade plan" button
```

## Key Changes

1. **docusignAPI.ts** - Simplified to extract code directly from response
2. **PDFUpload.tsx** - Simplified error handler to check code first
3. **No custom error classes** - Using plain Error with code property

## Result

✅ Backend sends code  
✅ Frontend receives code  
✅ Error handler detects code  
✅ User sees correct message with upgrade button  

---

**Build Status:** ✅ Success - Ready to test!
