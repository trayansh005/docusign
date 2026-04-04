import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import DocuSignTemplate from "../../models/DocuSignTemplate.js";
import { processWordDocument } from "../../utils/wordProcessor.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE_DIR = path.join(__dirname, "../../uploads/signatures");
const TEMPLATES_DIR = path.join(BASE_DIR, "templates");

/**
 * Migrate old templates to have proper pdfUrl
 */
export const migrateTemplates = async (request, reply) => {
  try {
    request.log.info("[Migration] Starting template migration...");

    const templates = await DocuSignTemplate.find({
      $or: [
        { pdfUrl: { $exists: false } },
        { pdfUrl: "" },
        { pdfUrl: null }
      ],
      isArchived: false
    });

    request.log.info(`[Migration] Found ${templates.length} templates to migrate`);

    const results = {
      success: [],
      failed: [],
      skipped: []
    };

    for (const template of templates) {
      const templateId = template._id.toString();
      const templateDir = path.join(TEMPLATES_DIR, templateId);

      try {
        if (!fs.existsSync(templateDir)) {
          request.log.warn(`[Migration] Template directory not found: ${templateDir}`);
          results.skipped.push({ id: templateId, name: template.name, reason: "Directory not found" });
          continue;
        }

        const isWordDoc = template.metadata?.mimeType?.includes('word') ||
          template.metadata?.mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
          template.metadata?.mimeType === 'application/msword';

        let pdfPath = null;

        if (isWordDoc) {
          const files = fs.readdirSync(templateDir);
          const existingPdf = files.find(f => f.endsWith('.pdf'));

          if (existingPdf) {
            pdfPath = path.join(templateDir, existingPdf);
          } else {
            const wordFile = files.find(f => f.endsWith('.docx') || f.endsWith('.doc'));
            if (wordFile) {
              const wordPath = path.join(templateDir, wordFile);
              const conversionResult = await processWordDocument(wordPath, templateDir, templateId);
              if (conversionResult.success) pdfPath = conversionResult.pdfPath;
              else throw new Error(`Conversion failed: ${conversionResult.error}`);
            } else throw new Error("No Word file found");
          }
        } else {
          const files = fs.readdirSync(templateDir);
          const pdfFile = files.find(f => f.endsWith('.pdf'));
          if (pdfFile) pdfPath = path.join(templateDir, pdfFile);
          else throw new Error("No PDF file found");
        }

        if (!pdfPath || !fs.existsSync(pdfPath)) throw new Error("PDF path invalid");

        const pdfFileName = path.basename(pdfPath);
        template.pdfUrl = `/api/uploads/signatures/templates/${templateId}/${pdfFileName}`;
        if (!template.metadata.originalFilePath) template.metadata.originalFilePath = template.pdfUrl;

        template.markModified("metadata");
        await template.save();

        results.success.push({ id: templateId, name: template.name, pdfUrl: template.pdfUrl });
      } catch (error) {
        request.log.error(`[Migration] Failed ${templateId}:`, error.message);
        results.failed.push({ id: templateId, name: template.name, error: error.message });
      }
    }

    return {
      success: true,
      message: "Migration completed",
      results: {
        total: templates.length,
        success: results.success.length,
        failed: results.failed.length,
        skipped: results.skipped.length
      },
      details: results
    };
  } catch (error) {
    request.log.error("[Migration] Error:", error);
    return reply.status(500).send({ success: false, message: error.message || "Migration failed" });
  }
};

