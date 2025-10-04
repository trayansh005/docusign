# DocuSign Site Migration Guide - PDF-First Architecture

## Overview

This document outlines the migration of the DocuSign Site from an **image-based** architecture to a **PDF-first** architecture, following the same structure as the RCSS Project DocuSign module.

**Migration Date:** October 4, 2025

---

## Key Changes Summary

### 1. Architecture Shift
- **Before:** PDF → Images (pdf2pic) → Store PNGs → Render signatures on images
- **After:** PDF → Store original PDF → Apply signatures directly with pdf-lib → Final signed PDF

### 2. Benefits
✅ **Smaller file sizes** - No need to store page images  
✅ **Faster processing** - Direct PDF manipulation  
✅ **Better quality** - Native PDF rendering  
✅ **Simpler workflow** - Fewer conversion steps  
✅ **Cross-platform** - No GraphicsMagick/Ghostscript dependencies  

---

## Backend Changes

### New Files Created

#### 1. **Models**
- `backend/models/DocuSignDocument.js` - NEW
  - Stores document metadata
  - Tracks file hashes for deduplication
  - Links to templates

#### 2. **Services**
- `backend/services/ActivityService.js` - NEW
  - Comprehensive activity logging
  - IP and geolocation tracking
  - Replaces inline activity logging

#### 3. **Validators**
- `backend/validators/TemplateValidator.js` - NEW
  - Template data validation
  - Status transition validation
  - Query building utilities

- `backend/validators/FieldValidator.js` - NEW
  - Signature field validation
  - Coordinate normalization (pixels to percentages)
  - Bulk field processing

#### 4. **Utilities**
- `backend/utils/pdfPathResolver.js` - NEW
  - PDF path resolution logic
  - Signed PDF path generation
  - Path to URL conversion

#### 5. **Controllers (New Organized Structure)**
- `backend/controllers/docusign/upload.controller.js` - NEW
- `backend/controllers/docusign/template.controller.js` - NEW
- `backend/controllers/docusign/fields.controller.js` - NEW
- `backend/controllers/docusign/signature.controller.js` - NEW (PDF-lib based)
- `backend/controllers/docusign/status.controller.js` - NEW

### Modified Files

#### 1. **Models**
**`backend/models/DocuSignTemplate.js`**

**Removed:**
```javascript
- imageUrl: String
- finalImageUrl: String
- metadata.imageHash
- metadata.finalImage
- metadata.pages (array of page images)
- docusignTemplateId
- docusignStatus
- recipients array
- auditTrail array (moved to Activity model)
```

**Added:**
```javascript
+ finalPdfUrl: String
+ metadata.document: ObjectId (ref to DocuSignDocument)
+ metadata.fileHash: String
+ signatureFields.fontId: String (for signature fonts)
+ signatureFields.value: String (for pre-filled values)
```

**Updated:**
```javascript
~ metadata.mimeType: "image/png" → "application/pdf"
~ signatureFields: Added normalized coordinates (xPct, yPct, wPct, hPct)
```

#### 2. **Routes**
**`backend/routes/docusign.js`**

**Removed Endpoints:**
```javascript
- GET /:templateId/pages/:pageNumber/image (image-based page serving)
- GET /:templateId/page/:pageNumber (legacy page info)
```

**Added Endpoints:**
```javascript
+ GET /:templateId (get template details)
+ PUT /:templateId (update template metadata)
+ GET /:templateId/fields (get all fields)
+ PUT /:templateId/fields (bulk update fields)
+ DELETE /:templateId/fields/:fieldId (delete specific field)
+ GET /status/statistics (status statistics)
```

**Modified Endpoints:**
```javascript
~ POST /upload (now PDF-first, no image conversion)
~ POST /:templateId/apply-signatures (uses pdf-lib instead of image rendering)
~ PUT /:templateId/page/:pageNumber/fields (uses normalized coordinates)
```

#### 3. **Package Dependencies**
**`backend/package.json`**

**Added:**
```json
"pdf-lib": "^1.17.1"
```

**Can be removed (optional - legacy):**
```json
"pdf2pic": "^3.0.2"  // No longer needed
```

---

## Database Schema Changes

### DocuSignTemplate Collection

**Migration Script Needed:**
```javascript
// Update existing templates to new schema
db.docusigntemplates.updateMany(
  {},
  {
    $unset: {
      "imageUrl": "",
      "finalImageUrl": "",
      "metadata.imageHash": "",
      "metadata.finalImage": "",
      "metadata.pages": "",
      "docusignTemplateId": "",
      "docusignStatus": "",
      "recipients": "",
      "auditTrail": ""
    },
    $set: {
      "finalPdfUrl": null,
      "metadata.mimeType": "application/pdf"
    }
  }
);
```

### New Collection: DocuSignDocuments
```javascript
{
  fileId: String,
  filename: String,
  mimeType: String,
  fileSize: Number,
  originalPdfPath: String,
  fileHash: String,  // SHA-256 for deduplication
  numPages: Number,
  pages: [{...}],    // Optional page metadata
  status: String,    // "pending" | "processing" | "ready" | "failed"
  template: ObjectId,
  createdAt: Date,
  updatedAt: Date
}
```

---

## Frontend Changes Required

### 1. Update API Service Files

**`frontend/services/docusignAPI.ts`** (or similar)

**Update Type Definitions:**
```typescript
// OLD
export type DocuSignTemplateData = {
  imageUrl?: string;
  finalImageUrl?: string;
  metadata: {
    imageHash?: string;
    pages: DocuSignTemplatePage[];
  };
};

// NEW
export type DocuSignTemplateData = {
  finalPdfUrl?: string;
  metadata: {
    originalPdfPath?: string;
    document?: string;  // Reference to DocuSignDocument
    fileHash?: string;
  };
};
```

**Update API Calls:**
```typescript
// Remove image-based page fetching
- getTemplatePage(templateId, pageNumber)

// Use direct PDF rendering
+ Use react-pdf or pdf.js to render PDFs client-side
```

### 2. Update Components

**Signature Field Placer:**
```typescript
// OLD - Load page images
<img src={`/api/docusign/${templateId}/pages/${page}/image`} />

// NEW - Use react-pdf
import { Document, Page } from 'react-pdf';
<Document file={pdfUrl}>
  <Page pageNumber={currentPage} />
</Document>
```

**Signature Interface:**
```typescript
// Update to use PDF viewer instead of image viewer
// Coordinates should be normalized to percentages (0-1)
const normalizedX = x / viewportWidth;
const normalizedY = y / viewportHeight;
```

### 3. Add Dependencies

**`frontend/package.json`:**
```json
{
  "dependencies": {
    "react-pdf": "^7.5.0",
    "pdfjs-dist": "^3.11.174",
    "pdf-lib": "^1.17.1"  // Optional, for client-side operations
  }
}
```

### 4. Configure PDF.js Worker

```typescript
import { pdfjs } from 'react-pdf';

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();
```

---

## Migration Steps

### Phase 1: Backend Updates ✅ COMPLETED

1. ✅ Create new models (DocuSignDocument)
2. ✅ Update DocuSignTemplate model
3. ✅ Create ActivityService
4. ✅ Create validators (TemplateValidator, FieldValidator)
5. ✅ Create utilities (pdfPathResolver)
6. ✅ Create new controller structure
7. ✅ Update routes
8. ✅ Add pdf-lib dependency

### Phase 2: Database Migration (TODO)

```bash
# Run migration script
node scripts/migrate-to-pdf-first.js
```

**Migration Script:**
```javascript
import mongoose from 'mongoose';
import DocuSignTemplate from './backend/models/DocuSignTemplate.js';
import DocuSignDocument from './backend/models/DocuSignDocument.js';
import fs from 'fs';
import crypto from 'crypto';

async function migrateToPdfFirst() {
  // 1. Find all templates with originalPdfPath
  const templates = await DocuSignTemplate.find({
    'metadata.originalPdfPath': { $exists: true }
  });

  for (const template of templates) {
    try {
      // 2. Create DocuSignDocument for each template
      const pdfPath = /* resolve path */;
      if (fs.existsSync(pdfPath)) {
        const fileBuffer = fs.readFileSync(pdfPath);
        const fileHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
        
        const doc = await DocuSignDocument.create({
          fileId: template.metadata.fileId,
          filename: template.metadata.filename,
          mimeType: 'application/pdf',
          fileSize: fileBuffer.length,
          originalPdfPath: template.metadata.originalPdfPath,
          fileHash,
          status: 'ready',
          template: template._id
        });

        // 3. Update template to reference document
        template.metadata.document = doc._id;
        template.metadata.fileHash = fileHash;
        await template.save();
      }
    } catch (err) {
      console.error(`Failed to migrate template ${template._id}:`, err);
    }
  }
}
```

### Phase 3: Frontend Updates (IN PROGRESS)

1. ⏳ Update type definitions
2. ⏳ Replace image-based viewers with react-pdf
3. ⏳ Update coordinate normalization
4. ⏳ Update API service calls
5. ⏳ Add PDF.js dependencies
6. ⏳ Configure PDF worker

### Phase 4: Testing (TODO)

1. ⏳ Test PDF upload
2. ⏳ Test field placement with normalized coordinates
3. ⏳ Test signature application with pdf-lib
4. ⏳ Test signed PDF download
5. ⏳ Test activity logging
6. ⏳ Test status transitions

### Phase 5: Cleanup (TODO)

1. Remove old controller: `backend/controllers/docusignController.js`
2. Remove unused dependencies (pdf2pic, GraphicsMagick)
3. Clean up old image files from storage
4. Update documentation

---

## API Endpoint Changes

### Removed Endpoints
```
GET /api/docusign/:templateId/pages/:pageNumber/image
GET /api/docusign/:templateId/page/:pageNumber
```

### New Endpoints
```
GET    /api/docusign/:templateId              - Get template details
PUT    /api/docusign/:templateId              - Update template
GET    /api/docusign/:templateId/fields       - Get all fields
PUT    /api/docusign/:templateId/fields       - Bulk update fields
DELETE /api/docusign/:templateId/fields/:fieldId - Delete field
GET    /api/docusign/status/statistics        - Get status stats
```

### Modified Endpoints
```
POST /api/docusign/upload
  - Now returns template with originalPdfPath instead of imageUrl
  - No image conversion

POST /api/docusign/:templateId/apply-signatures
  - Uses pdf-lib for direct PDF manipulation
  - Returns finalPdfUrl instead of finalImageUrl

PUT /api/docusign/:templateId/page/:pageNumber/fields
  - Accepts viewport dimensions for coordinate normalization
  - Stores both pixel and percentage coordinates
```

---

## Breaking Changes

### 1. Response Format Changes

**Before:**
```json
{
  "imageUrl": "/uploads/signatures/templates/abc123/page_1.png",
  "finalImageUrl": "/uploads/signatures/signed/abc123/final.png",
  "metadata": {
    "imageHash": "sha256hash",
    "pages": [
      {
        "pageNumber": 1,
        "imageUrl": "/uploads/...",
        "imageHash": "..."
      }
    ]
  }
}
```

**After:**
```json
{
  "finalPdfUrl": "/uploads/signatures/signed/abc123/abc123-final.pdf",
  "metadata": {
    "originalPdfPath": "/uploads/signatures/templates/abc123.pdf",
    "document": "docId123",
    "fileHash": "sha256hash"
  }
}
```

### 2. Signature Field Coordinates

**Before:** Absolute pixels only
```json
{
  "x": 100,
  "y": 200,
  "width": 150,
  "height": 50
}
```

**After:** Normalized percentages (preferred) + pixel fallback
```json
{
  "x": 100,
  "y": 200,
  "width": 150,
  "height": 50,
  "xPct": 0.1,
  "yPct": 0.2,
  "wPct": 0.15,
  "hPct": 0.05
}
```

---

## File Structure Changes

### New Directory Structure
```
backend/
├── controllers/
│   └── docusign/           ← NEW organized structure
│       ├── upload.controller.js
│       ├── template.controller.js
│       ├── fields.controller.js
│       ├── signature.controller.js
│       └── status.controller.js
├── models/
│   ├── DocuSignTemplate.js (updated)
│   ├── DocuSignDocument.js ← NEW
│   └── Activity.js (existing)
├── services/
│   ├── ActivityService.js  ← NEW
│   └── ipLocationService.js (existing)
├── validators/             ← NEW directory
│   ├── TemplateValidator.js
│   └── FieldValidator.js
└── utils/                  ← NEW directory
    └── pdfPathResolver.js
```

### Files to Remove (After Migration Complete)
```
backend/controllers/docusignController.js (old monolithic controller)
```

---

## Environment Variables

No new environment variables required. The existing setup works with the new architecture.

---

## Compatibility Notes

### Backward Compatibility
- ✅ Old templates with `imageUrl` will still work (read-only)
- ✅ Existing signature fields with pixel coordinates supported
- ✅ Activity logs remain accessible
- ⚠️ Image-based page endpoints removed (breaking change)

### Migration Path
1. Deploy backend changes
2. Run database migration
3. Deploy frontend changes
4. Monitor for issues
5. Clean up old data/code

---

## Testing Checklist

### Backend Tests
- [ ] Upload PDF → Creates template and document
- [ ] Place signature fields → Stores normalized coordinates
- [ ] Apply signatures → Generates final PDF with pdf-lib
- [ ] Status transitions → Updates correctly
- [ ] Activity logging → Captures all events with IP/location
- [ ] Field validation → Rejects invalid data
- [ ] Template CRUD → All operations work

### Frontend Tests
- [ ] PDF viewer renders correctly
- [ ] Field placement works on PDF
- [ ] Signature creation (type/draw/upload)
- [ ] Signature application
- [ ] Download signed PDF
- [ ] Status tracking
- [ ] Activity timeline

### Integration Tests
- [ ] Complete flow: Upload → Place fields → Sign → Download
- [ ] Multiple users/recipients
- [ ] Error handling
- [ ] Performance (large PDFs)

---

## Rollback Plan

If issues arise:

1. **Keep old controller file** as backup
2. **Database**: Old schema fields still present (not deleted)
3. **Switch routes** back to old controller
4. **Revert frontend** to image-based viewer

**Note:** Once final PDFs are generated with pdf-lib, they cannot be recreated with the old image-based method.

---

## Support & Resources

### Documentation
- RCSS DocuSign Documentation: `RCSS_Project/docs/DOCUSIGN_MODULE_DOCUMENTATION.md`
- pdf-lib Docs: https://pdf-lib.js.org/
- react-pdf Docs: https://github.com/wojtekmaj/react-pdf

### Troubleshooting
- Check logs in `backend/logs/` (if configured)
- Monitor Activity collection for tracking
- Verify file paths in `uploads/signatures/`

---

## Next Steps

1. **Install Dependencies:**
   ```bash
   cd "DocuSign Site/backend"
   npm install pdf-lib
   ```

2. **Create Migration Script:**
   ```bash
   node scripts/migrate-to-pdf-first.js
   ```

3. **Update Frontend:**
   - Install react-pdf
   - Update components
   - Test PDF rendering

4. **Deploy:**
   - Deploy backend
   - Run migration
   - Deploy frontend

5. **Monitor:**
   - Watch error logs
   - Monitor activity logs
   - Check user feedback

---

## Conclusion

This migration brings the DocuSign Site to parity with the RCSS Project's modern PDF-first architecture. The changes eliminate unnecessary image conversion, improve performance, and provide a cleaner, more maintainable codebase.

**Status:** Backend migration complete ✅  
**Next:** Frontend updates and testing 🚧
