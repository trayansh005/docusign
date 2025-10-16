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
 * This fixes templates created before the refactor
 */
export const migrateTemplates = async (req, res) => {
    try {
        console.log("[Migration] Starting template migration...");

        // Find all templates without pdfUrl
        const templates = await DocuSignTemplate.find({
            $or: [
                { pdfUrl: { $exists: false } },
                { pdfUrl: "" },
                { pdfUrl: null }
            ],
            isArchived: false
        });

        console.log(`[Migration] Found ${templates.length} templates to migrate`);

        const results = {
            success: [],
            failed: [],
            skipped: []
        };

        for (const template of templates) {
            const templateId = template._id.toString();
            const templateDir = path.join(TEMPLATES_DIR, templateId);

            console.log(`[Migration] Processing template: ${templateId} - ${template.name}`);

            try {
                // Check if template directory exists
                if (!fs.existsSync(templateDir)) {
                    console.warn(`[Migration] Template directory not found: ${templateDir}`);
                    results.skipped.push({
                        id: templateId,
                        name: template.name,
                        reason: "Directory not found"
                    });
                    continue;
                }

                // Check if this is a Word document
                const isWordDoc = template.metadata?.mimeType?.includes('word') ||
                    template.metadata?.mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
                    template.metadata?.mimeType === 'application/msword';

                let pdfPath = null;

                if (isWordDoc) {
                    // For Word documents, check if PDF already exists or convert
                    const files = fs.readdirSync(templateDir);
                    const existingPdf = files.find(f => f.endsWith('.pdf'));

                    if (existingPdf) {
                        pdfPath = path.join(templateDir, existingPdf);
                        console.log(`[Migration] Found existing PDF: ${existingPdf}`);
                    } else {
                        // Find the Word file
                        const wordFile = files.find(f =>
                            f.endsWith('.docx') || f.endsWith('.doc')
                        );

                        if (wordFile) {
                            const wordPath = path.join(templateDir, wordFile);
                            console.log(`[Migration] Converting Word to PDF: ${wordFile}`);

                            const conversionResult = await processWordDocument(wordPath, templateDir, templateId);

                            if (conversionResult.success) {
                                pdfPath = conversionResult.pdfPath;
                                console.log(`[Migration] Conversion successful: ${pdfPath}`);
                            } else {
                                throw new Error(`Conversion failed: ${conversionResult.error}`);
                            }
                        } else {
                            throw new Error("No Word file found in template directory");
                        }
                    }
                } else {
                    // For PDF documents, find the PDF file
                    const files = fs.readdirSync(templateDir);
                    const pdfFile = files.find(f => f.endsWith('.pdf'));

                    if (pdfFile) {
                        pdfPath = path.join(templateDir, pdfFile);
                        console.log(`[Migration] Found PDF: ${pdfFile}`);
                    } else {
                        throw new Error("No PDF file found in template directory");
                    }
                }

                if (!pdfPath || !fs.existsSync(pdfPath)) {
                    throw new Error("PDF path not found or invalid");
                }

                // Update template with pdfUrl
                const pdfFileName = path.basename(pdfPath);
                template.pdfUrl = `/api/uploads/signatures/templates/${templateId}/${pdfFileName}`;

                // Also update metadata if needed
                if (!template.metadata.originalFilePath) {
                    template.metadata.originalFilePath = template.pdfUrl;
                }

                template.markModified("metadata");
                await template.save();

                console.log(`[Migration] Successfully migrated template: ${templateId}`);
                results.success.push({
                    id: templateId,
                    name: template.name,
                    pdfUrl: template.pdfUrl
                });

            } catch (error) {
                console.error(`[Migration] Failed to migrate template ${templateId}:`, error.message);
                results.failed.push({
                    id: templateId,
                    name: template.name,
                    error: error.message
                });
            }
        }

        console.log("[Migration] Migration complete:", results);

        return res.status(200).json({
            success: true,
            message: "Migration completed",
            results: {
                total: templates.length,
                success: results.success.length,
                failed: results.failed.length,
                skipped: results.skipped.length
            },
            details: results
        });

    } catch (error) {
        console.error("[Migration] Migration error:", error);
        return res.status(500).json({
            success: false,
            message: error.message || "Migration failed"
        });
    }
};
