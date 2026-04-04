import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { v4 as uuidv4 } from "uuid";
import crypto from "crypto";
import DocuSignTemplate from "../../models/DocuSignTemplate.js";
import Subscription from "../../models/Subscription.js";
import DocuSignDocument from "../../models/DocuSignDocument.js";
import { logDocuSignActivity } from "../../services/ActivityService.js";
import { processWordDocument, isWordDocument } from "../../utils/wordProcessor.js";
import { generatePdfThumbnail } from "../../utils/pdfThumbnailGenerator.js";
import { getFreeTierLimits } from "../../utils/freeTierLimits.js";
import { pipeline } from "stream/promises";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE_DIR = path.join(__dirname, "../../uploads/signatures");
const TEMPLATES_DIR = path.join(BASE_DIR, "templates");
const PDFS_DIR = path.join(BASE_DIR, "pdfs");

// Ensure directories exist
function ensureDirs() {
  [BASE_DIR, TEMPLATES_DIR, PDFS_DIR].forEach((dir) => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  });
}

/**
 * Create initial template record
 */
async function createInitialTemplate(fileInfo, name, type, userId) {
  const template = await DocuSignTemplate.create({
    name: name || `Document ${path.parse(fileInfo.filename).name}`,
    type: type || "document",
    status: "draft",
    createdBy: userId,
    metadata: {
      filename: fileInfo.filename,
      mimeType: fileInfo.mimetype,
    },
  });

  return template;
}

/**
 * Mark template as failed
 */
async function markTemplateAsFailed(template, errorMessage) {
  try {
    template.status = "failed";
    template.metadata = template.metadata || {};
    template.metadata.error = errorMessage;
    await template.save();
  } catch (err) {
    console.error("Failed to mark template as failed:", err);
  }
}

/**
 * Get PDF page count using pdf-lib
 */
async function getPdfPageCount(pdfPath) {
  try {
    const { PDFDocument } = await import("pdf-lib");
    const pdfBytes = fs.readFileSync(pdfPath);
    const pdfDoc = await PDFDocument.load(pdfBytes);
    return pdfDoc.getPageCount();
  } catch (error) {
    console.error("Error getting PDF page count:", error);
    throw new Error("Failed to read PDF page count");
  }
}

/**
 * Upload and process PDF or Word document
 */
export const uploadAndProcessDocument = async (request, reply) => {
  let template;
  let tempFilePath;

  try {
    const userId = request.user?.id;
    if (!userId) {
      return reply.status(401).send({ success: false, message: "Authentication required" });
    }

    // Get the file from multipart request
    const data = await request.file();
    if (!data) {
      return reply.status(400).send({ success: false, message: "No document file uploaded" });
    }

    const { filename, mimetype, file } = data;
    const allowedMimeTypes = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/msword",
    ];

    if (!allowedMimeTypes.includes(mimetype)) {
      return reply.status(400).send({ success: false, message: "Only PDF, DOCX, and DOC files are allowed" });
    }

    // Enforce free-tier limit
    const now = new Date();
    const activeSub = await Subscription.findOne({
      userId,
      status: "active",
      $or: [{ endDate: { $exists: false } }, { endDate: { $gt: now } }],
    });

    if (!activeSub) {
      const existingCount = await DocuSignTemplate.countDocuments({
        createdBy: userId,
        isArchived: { $ne: true },
      });

      const { uploadLimit } = getFreeTierLimits();
      if (existingCount >= uploadLimit) {
        return reply.status(403).send({
          success: false,
          code: "FREE_LIMIT_REACHED",
          message: "Free plan limit reached. Upgrade to upload more documents.",
        });
      }
    }

    // Prepare temporary storage
    ensureDirs();
    const uniqueId = uuidv4();
    const ext = path.extname(filename);
    const tempFilename = `${uniqueId}${ext}`;
    tempFilePath = path.join(PDFS_DIR, tempFilename);

    // Save the file stream to temp location
    await pipeline(file, fs.createWriteStream(tempFilePath));

    // Get non-file fields (name, type)
    const { name, type = "document" } = data.fields || {};
    const nameValue = name?.value;
    const typeValue = type?.value || "document";

    // Create initial template record
    template = await createInitialTemplate({ filename, mimetype }, nameValue, typeValue, userId);
    template.status = "processing";
    await template.save();

    const templateId = template._id.toString();
    const templateDir = path.join(TEMPLATES_DIR, templateId);
    if (!fs.existsSync(templateDir)) fs.mkdirSync(templateDir, { recursive: true });

    // Move uploaded file to template directory
    const safeOriginalName = path.basename(filename).replace(/[^a-zA-Z0-9._-]/g, "_");
    const storedFileName = `${templateId}_${safeOriginalName}`;
    const newFilePath = path.join(templateDir, storedFileName);
    fs.renameSync(tempFilePath, newFilePath);
    tempFilePath = null; // Mark as moved

    let pdfFilePath = newFilePath;
    let numPages = 0;

    // Process based on file type
    if (isWordDocument(mimetype)) {
      const conversionResult = await processWordDocument(newFilePath, templateDir, templateId);
      if (conversionResult.success) {
        pdfFilePath = conversionResult.pdfPath;
        numPages = await getPdfPageCount(pdfFilePath);
      } else {
        throw new Error(`Word to PDF conversion failed: ${conversionResult.error}`);
      }
    } else if (mimetype === "application/pdf") {
      numPages = await getPdfPageCount(pdfFilePath);
    }

    if (numPages === 0) {
      throw new Error("PDF has no pages or could not be read");
    }

    // Generate thumbnail
    const thumbnailPath = path.join(templateDir, "thumbnail.png");
    const thumbnailResult = await generatePdfThumbnail(pdfFilePath, thumbnailPath);

    let thumbnailUrl = null;
    if (thumbnailResult.success) {
      thumbnailUrl = `/api/uploads/signatures/templates/${templateId}/thumbnail.png`;
    }

    // Update template
    template.name = nameValue || path.parse(filename).name;
    template.numPages = numPages;
    template.status = "draft";

    const normalizedPdfPath = pdfFilePath.replace(/\\/g, "/");
    const pdfFileNameOut = normalizedPdfPath.split("/").pop();
    const pdfUrl = `/api/uploads/signatures/templates/${templateId}/${pdfFileNameOut}`;

    if (isWordDocument(mimetype)) {
      template.metadata.originalWordFile = storedFileName;
      template.metadata.convertedFromWord = true;
    }

    const fileSize = fs.statSync(newFilePath).size;
    template.metadata = {
      ...template.metadata,
      fileId: templateId,
      mimeType: mimetype,
      fileSize: fileSize,
      originalPdfPath: pdfUrl,
      originalFilePath: `/api/uploads/signatures/templates/${templateId}/${storedFileName}`,
      thumbnailUrl: thumbnailUrl,
    };

    template.markModified("metadata");
    await template.save();

    // Create DocuSignDocument record
    try {
      const fileBuffer = fs.readFileSync(newFilePath);
      const fileHash = crypto.createHash("sha256").update(fileBuffer).digest("hex");
      const doc = await DocuSignDocument.create({
        fileId: templateId,
        filename: filename,
        mimeType: mimetype,
        fileSize: fileSize,
        originalPdfPath: `/uploads/signatures/templates/${templateId}/${storedFileName}`,
        fileHash,
        status: "ready",
        template: template._id,
      });

      template.metadata.document = doc._id;
      template.metadata.fileHash = fileHash;
      template.markModified("metadata");
      await template.save();
    } catch (err) {
      request.log.warn("Failed to create DocuSignDocument record:", err.message);
    }

    // Log activity
    await logDocuSignActivity(
      userId,
      "DOCUSIGN_TEMPLATE_CREATED",
      `Created DocuSign template: ${template.name}`,
      { templateId: template._id, name: template.name, type: template.type },
      request
    );

    return reply.status(201).send({
      success: true,
      data: template.toObject(),
      message: "Document processed successfully",
    });
  } catch (error) {
    request.log.error("uploadAndProcessDocument error:", error);

    if (template) {
      await markTemplateAsFailed(template, error.message);
    }

    if (tempFilePath && fs.existsSync(tempFilePath)) {
      try {
        fs.unlinkSync(tempFilePath);
      } catch (cleanupErr) {
        request.log.error("Failed to cleanup temp file:", cleanupErr);
      }
    }

    return reply.status(500).send({
      success: false,
      message: error.message || "Failed to process document",
    });
  }
};

