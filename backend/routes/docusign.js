import express from "express";
import { authenticateToken } from "../middleware/auth.js";
import {
	upload,
	uploadAndProcessPDF,
	getTemplatePage,
	updateTemplatePageFields,
	deleteTemplate,
	listTemplates,
	applySignatures,
	getSignedDocument,
	getTemplatePageImage,
	updateTemplateStatus,
	getTemplateStatusHistory,
	getTemplatesByStatus,
	getSignatureTracking,
} from "../controllers/docusignController.js";

const router = express.Router();

// Apply authentication to all routes
router.use(authenticateToken);

// PDF Upload and processing
router.post("/upload", upload.single("pdf"), uploadAndProcessPDF);

// Template management
router.get("/", listTemplates);
router.delete("/:templateId", deleteTemplate);

// Page-specific operations
router.get("/:templateId/pages/:pageNumber/image", getTemplatePageImage);
router.get("/:templateId/page/:pageNumber", getTemplatePage);
router.put("/:templateId/page/:pageNumber/fields", updateTemplatePageFields);

// Signature operations
router.post("/:templateId/apply-signatures", applySignatures);
router.get("/:templateId/signed", getSignedDocument);

// Status tracking
router.put("/:templateId/status", updateTemplateStatus);
router.get("/:templateId/status-history", getTemplateStatusHistory);
router.get("/status/filter", getTemplatesByStatus);

// Signature tracking endpoint
router.get("/:templateId/signature-tracking", getSignatureTracking);

export default router;
