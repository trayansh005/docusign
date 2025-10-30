# Signature Debugging Guide

## Issue
Recipient signatures are not appearing in the final PDF generated after signing.

## Changes Made

### 1. Enhanced Backend Logging (`backend/controllers/docusign/recipient-sign.controller.js`)

Added detailed logging at key points in the signature processing flow:

- **Buffer validation**: Logs buffer length and validity
- **Coordinate validation**: Checks if coordinates are valid numbers and have positive dimensions
- **Image embedding**: Logs each attempt (PNG, JPG, Sharp conversion) with success/failure messages
- **Image drawing**: Logs the exact coordinates where the image is being drawn
- **Error handling**: More detailed error messages

### 2. Fixed Frontend Payload (`frontend/src/app/fomiqsign/sign/[templateId]/SignDocumentClient.tsx`)

Added `fontId` to the signature payload sent to the backend. This is important for typed signatures that need custom fonts.

## How to Debug

### Step 1: Test the Signing Flow

1. Start the backend server
2. Navigate to a document that needs signing
3. Add a signature (either drawn or typed)
4. Click "Sign Document"
5. Check the backend console logs

### Step 2: Analyze the Logs

Look for these log patterns in order:

```
[ApplySignatures] Received X signature entries for template <templateId>
```

For each signature, you should see:

```
Processing field <fieldId> type=signature - buffer=true plainText=false
[ApplySignatures] Buffer details for <fieldId>: length=XXXX, isBuffer=true
[ApplySignatures] Target coordinates: left=X, top=Y, width=W, height=H
[ApplySignatures] Coordinate validity: left=true, top=true, width=true, height=true
[ApplySignatures] Processing image signature for field <fieldId>, buffer length: XXXX
[ApplySignatures] Attempting to embed image for field <fieldId>
[ApplySignatures] Successfully embedded PNG for field <fieldId>
[ApplySignatures] Drawing image for <fieldId> at x=X.XX, y=Y.YY, width=W.WW, height=H.HH
[ApplySignatures] Successfully drew signature image for field <fieldId>
```

### Step 3: Identify the Problem

**If you see:**

1. **"Invalid coordinates" or "Invalid dimensions"**
   - The frontend is sending incorrect coordinate data
   - Check the `xPct`, `yPct`, `wPct`, `hPct` values in the signature payload

2. **"Failed to decode base64 image"**
   - The image data is corrupted or in wrong format
   - Check the `signatureImageBuffer` value in the frontend

3. **"PNG embed failed" → "JPG embed failed" → "All image embed attempts failed"**
   - The image buffer is not a valid image format
   - Check if the signature canvas is generating valid image data

4. **"No valid signature data for field"**
   - The signature data is not reaching the backend correctly
   - Check the frontend signature capture logic

5. **"Error processing signature"**
   - An unexpected error occurred
   - Check the full error stack trace

### Step 4: Common Issues and Solutions

#### Issue: Coordinates are NaN or undefined
**Solution**: Ensure the frontend is sending percentage-based coordinates (0-100 or 0-1)

```javascript
// Frontend should send:
{
  xPct: 10,  // or 0.1
  yPct: 20,  // or 0.2
  wPct: 30,  // or 0.3
  hPct: 5    // or 0.05
}
```

#### Issue: Image buffer is empty or invalid
**Solution**: Check the signature canvas `toDataURL()` method

```javascript
// Should generate:
"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA..."
```

#### Issue: Signature appears but in wrong location
**Solution**: Verify coordinate system conversion (top-left vs bottom-left origin)

The PDF coordinate system has origin at bottom-left, while canvas has origin at top-left.

## Testing Checklist

- [ ] Backend server is running
- [ ] Frontend is connected to backend
- [ ] User can see the document
- [ ] User can add signature fields
- [ ] User can draw/type signatures
- [ ] Signature data is captured (check browser console)
- [ ] Signature payload is sent to backend (check network tab)
- [ ] Backend receives signature data (check backend logs)
- [ ] Image embedding succeeds (check backend logs)
- [ ] Image drawing succeeds (check backend logs)
- [ ] Final PDF is generated
- [ ] Final PDF contains the signature

## Next Steps

After running the test and collecting logs:

1. Share the complete backend console output
2. Share the browser console output (especially the "Signatures being sent to backend" log)
3. Share the network request payload for the `/sign` endpoint
4. If possible, share a screenshot of the signature field before signing

This will help identify exactly where the signature processing is failing.
