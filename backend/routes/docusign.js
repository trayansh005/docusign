import express from "express";
import { authenticateToken } from "../middleware/auth.js";

// Import optimized controllers
import { upload, uploadAndProcessPDF } from "../controllers/docusign/upload.controller.js";
import {
	listTemplates,
	getTemplate,
	deleteTemplate,
	updateTemplate,
} from "../controllers/docusign/template.controller.js";
import {
	updateTemplatePageFields,
	updateTemplateFields,
	deleteSignatureField,
	getTemplateFields,
} from "../controllers/docusign/fields.controller.js";
import {
	applySignatures,
	getSignedDocument,
} from "../controllers/docusign/signature.controller.js";
import {
	updateTemplateStatus,
	getTemplateStatusHistory,
	getTemplatesByStatus,
	getSignatureTracking,
	getStatusStatistics,
} from "../controllers/docusign/status.controller.js";

const router = express.Router();

// Apply authentication to all routes
router.use(authenticateToken);

// ===== OPTIMIZED ROUTES =====

// PDF Upload and processing (optimized)
router.post("/upload", upload.single("pdf"), uploadAndProcessPDF);

// Template management (optimized)
router.get("/", listTemplates);
router.get("/:templateId", getTemplate);
router.put("/:templateId", updateTemplate);
router.delete("/:templateId", deleteTemplate);

// Page-specific operations (optimized)
router.put("/:templateId/page/:pageNumber/fields", updateTemplatePageFields);

// Field management (optimized)
router.get("/:templateId/fields", getTemplateFields);
router.put("/:templateId/fields", updateTemplateFields);
router.delete("/:templateId/fields/:fieldId", deleteSignatureField);

// ===== SIGNATURE ROUTES =====

// Signature application (optimized with pdf-lib)
router.post("/:templateId/apply-signatures", applySignatures);
router.get("/:templateId/signed", getSignedDocument);

// ===== STATUS & TRACKING ROUTES =====

// Status management (optimized)
router.put("/:templateId/status", updateTemplateStatus);
router.get("/:templateId/status-history", getTemplateStatusHistory);
router.get("/status/filter", getTemplatesByStatus);
router.get("/status/statistics", getStatusStatistics);

// Signature tracking (optimized)
router.get("/:templateId/signature-tracking", getSignatureTracking);

export default router;
