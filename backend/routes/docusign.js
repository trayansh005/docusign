import express from "express";
import { authenticateToken } from "../middleware/auth.js";

// Import optimized controllers
import { upload, uploadAndProcessDocument } from "../controllers/docusign/upload.controller.js";
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
import { recipientSignDocument } from "../controllers/docusign/recipient-sign.controller.js";
import {
	updateTemplateStatus,
	getTemplateStatusHistory,
	getTemplatesByStatus,
	getSignatureTracking,
	getStatusStatistics,
} from "../controllers/docusign/status.controller.js";
import { migrateTemplates } from "../controllers/docusign/migration.controller.js";
import {
	migrateSigningOrder,
	fixTemplateSigningOrder
} from "../controllers/docusign/migration-signing-order.controller.js";
import {
	addRecipients,
	updateSigningOrder,
	removeRecipient,
	getSigningProgress,
	checkSigningEligibility,
} from "../controllers/docusign/recipients.controller.js";

const router = express.Router();

// Apply authentication to all routes
router.use(authenticateToken);

// ===== OPTIMIZED ROUTES =====

// Document Upload and processing (optimized) - supports PDF and Word documents
router.post(
	"/upload",
	(req, res, next) => {
		// Wrap multer to capture errors like LIMIT_FILE_SIZE
		const handler = upload.single("document");
		handler(req, res, function (err) {
			if (err) {
				// Multer-specific size limit error
				if (err.code === "LIMIT_FILE_SIZE") {
					return res.status(413).json({
						success: false,
						code: "PAYLOAD_TOO_LARGE",
						message: "File is too large. Maximum allowed size is 20 MB.",
					});
				}
				// Other multer errors
				return res.status(400).json({ success: false, message: err.message });
			}
			next();
		});
	},
	uploadAndProcessDocument
);

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

// Unified signing endpoint (handles both recipient and sender signing)
router.post("/:templateId/sign", recipientSignDocument);

// Legacy signature application endpoint (deprecated - use /sign instead)
// TODO: Remove this endpoint after frontend migration is complete
router.post("/:templateId/apply-signatures", applySignatures);
router.get("/:templateId/signed", getSignedDocument);

// ===== RECIPIENTS & SIGNING ORDER ROUTES =====

// Recipient management
router.post("/:templateId/recipients", addRecipients);
router.put("/:templateId/recipients/order", updateSigningOrder);
router.delete("/:templateId/recipients/:recipientId", removeRecipient);

// Signing progress and eligibility
router.get("/:templateId/signing-progress", getSigningProgress);
router.get("/:templateId/signing-eligibility", checkSigningEligibility);

// ===== STATUS & TRACKING ROUTES =====

// Status management (optimized)
router.put("/:templateId/status", updateTemplateStatus);
router.get("/:templateId/status-history", getTemplateStatusHistory);
router.get("/status/filter", getTemplatesByStatus);
router.get("/status/statistics", getStatusStatistics);

// Signature tracking (optimized)
router.get("/:templateId/signature-tracking", getSignatureTracking);

// ===== MIGRATION ROUTES =====

// Migrate old templates to new format
router.post("/migrate", migrateTemplates);

// Migrate signing order for existing templates
router.post("/migrate-signing-order", migrateSigningOrder);
router.post("/:templateId/fix-signing-order", fixTemplateSigningOrder);

export default router;
