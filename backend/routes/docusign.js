import { authenticateSession } from "../middleware/sessionAuth.js";
import { checkFreeTierSigningLimit } from "../middleware/checkFreeTierLimit.js";

// Import optimized controllers
import { uploadAndProcessDocument } from "../controllers/docusign/upload.controller.js";
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

/**
 * DocuSign routes Fastify plugin
 */
export default async function docusignRoutes(fastify, options) {
  // Apply authentication to all routes in this plugin
  fastify.addHook("preHandler", authenticateSession);

  // ===== OPTIMIZED ROUTES =====

  // Document Upload and processing
  fastify.post("/upload", uploadAndProcessDocument);

  // Template management
  fastify.get("/", listTemplates);
  fastify.get("/:templateId", getTemplate);
  fastify.put("/:templateId", updateTemplate);
  fastify.delete("/:templateId", deleteTemplate);

  // Page-specific operations
  fastify.put("/:templateId/page/:pageNumber/fields", updateTemplatePageFields);

  // Field management
  fastify.get("/:templateId/fields", getTemplateFields);
  fastify.put("/:templateId/fields", updateTemplateFields);
  fastify.delete("/:templateId/fields/:fieldId", deleteSignatureField);

  // ===== SIGNATURE ROUTES =====

  // Unified signing endpoint
  fastify.post("/:templateId/sign", { preHandler: [checkFreeTierSigningLimit] }, recipientSignDocument);

  // Legacy signature application endpoint (deprecated)
  fastify.post("/:templateId/apply-signatures", { preHandler: [checkFreeTierSigningLimit] }, applySignatures);
  fastify.get("/:templateId/signed", getSignedDocument);

  // ===== RECIPIENTS & SIGNING ORDER ROUTES =====

  // Recipient management
  fastify.post("/:templateId/recipients", addRecipients);
  fastify.put("/:templateId/recipients/order", updateSigningOrder);
  fastify.delete("/:templateId/recipients/:recipientId", removeRecipient);

  // Signing progress and eligibility
  fastify.get("/:templateId/signing-progress", getSigningProgress);
  fastify.get("/:templateId/signing-eligibility", checkSigningEligibility);

  // ===== STATUS & TRACKING ROUTES =====

  // Status management
  fastify.put("/:templateId/status", updateTemplateStatus);
  fastify.get("/:templateId/status-history", getTemplateStatusHistory);
  fastify.get("/status/filter", getTemplatesByStatus);
  fastify.get("/status/statistics", getStatusStatistics);

  // Signature tracking
  fastify.get("/:templateId/signature-tracking", getSignatureTracking);

  // ===== MIGRATION ROUTES =====

  // Migrate old templates
  fastify.post("/migrate", migrateTemplates);

  // Migrate signing order
  fastify.post("/migrate-signing-order", migrateSigningOrder);
  fastify.post("/:templateId/fix-signing-order", fixTemplateSigningOrder);
}

