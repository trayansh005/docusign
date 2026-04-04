import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";
import { PDFDocument as PDFLibDocument, StandardFonts } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import DocuSignTemplate from "../../models/DocuSignTemplate.js";
import Subscription from "../../models/Subscription.js";
import { getFreeTierLimits } from "../../utils/freeTierLimits.js";
import DocuSignDocument from "../../models/DocuSignDocument.js";
import { logDocuSignActivity } from "../../services/ActivityService.js";
import { TemplateValidator } from "../../validators/TemplateValidator.js";
import { FieldValidator } from "../../validators/FieldValidator.js";
import {
  resolveTemplatePdfPath,
  getSignedPdfPath,
  pathToUrl,
} from "../../utils/pdfPathResolver.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Process signature data from request with multiple lookup strategies
 */
function processSignatureData(signatures) {
  const signatureMap = new Map();

  if (!Array.isArray(signatures)) {
    return signatureMap;
  }

  for (const signature of signatures) {
    try {
      let buffer = null;
      const rawData =
        signature.signatureImageBuffer || signature.image || signature.dataUrl || signature.dataURL;

      if (typeof rawData === "string") {
        const base64Data = rawData.trim().replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, "");
        if (base64Data) {
          buffer = Buffer.from(base64Data, "base64");
        }
      } else if (Buffer.isBuffer(rawData)) {
        buffer = rawData;
      }

      if (buffer) {
        const keys = [
          signature.id,
          signature.fieldId || signature.fieldID || signature.field_id || signature.field || signature.fieldName,
          `${signature.pageNumber}:${signature.recipientId}:${signature.type}`,
          `${signature.pageNumber}:${signature.recipientId}`,
          `${signature.recipientId}:${signature.type}`,
          `${signature.recipientId}`,
          `${signature.pageNumber}-${signature.recipientId}-${signature.type}`,
        ].filter(Boolean);

        keys.forEach((key) => signatureMap.set(String(key), buffer));

        if (signature.index != null) {
          signatureMap.set(`index:${signature.index}`, buffer);
        }
      }
    } catch (error) {
      console.warn("Failed to process signature:", error.message);
    }
  }

  return signatureMap;
}

/**
 * Calculate field dimensions and position with smart viewport estimation
 */
function calculateFieldDimensions(field, pageWidth, pageHeight, viewport, pageNumber) {
  const defaultWidth = 160;
  const defaultHeight = 48;

  const vp = viewport?.[pageNumber] || viewport?.[String(pageNumber)] || {};
  let baseW = field.viewportWidth || field.uiWidth || vp?.width;
  let baseH = field.viewportHeight || field.uiHeight || vp?.height;

  if (!baseW || !baseH) {
    const pageAspectRatio = pageWidth && pageHeight ? pageWidth / pageHeight : 1.414;
    if (pageAspectRatio > 1.5) {
      baseW = 1000;
      baseH = Math.round(1000 / pageAspectRatio);
    } else {
      baseW = 800;
      baseH = Math.round(800 / pageAspectRatio);
    }
  }

  const xPct = field.xPct != null ? field.xPct : baseW && field.x != null ? (field.x / baseW) * 100 : 0;
  const yPct = field.yPct != null ? field.yPct : baseH && field.y != null ? (field.y / baseH) * 100 : 0;
  const wPct = field.wPct != null ? field.wPct : baseW && field.width != null ? (field.width / baseW) * 100 : undefined;
  const hPct = field.hPct != null ? field.hPct : baseH && field.height != null ? (field.height / baseH) * 100 : undefined;

  const targetWidth = Math.max(1, Math.round(wPct != null && pageWidth ? (wPct / 100) * pageWidth : field.width || defaultWidth));
  const targetHeight = Math.max(1, Math.round(hPct != null && pageHeight ? (hPct / 100) * pageHeight : field.height || defaultHeight));
  const left = Math.max(0, Math.round(xPct != null && pageWidth ? (xPct / 100) * pageWidth : field.x || 0));
  const top = Math.max(0, Math.round(yPct != null && pageHeight ? (yPct / 100) * pageHeight : field.y || 0));

  return {
    width: targetWidth,
    height: targetHeight,
    left: pageWidth ? Math.min(left, Math.max(0, pageWidth - targetWidth)) : left,
    top: pageHeight ? Math.min(top, Math.max(0, pageHeight - targetHeight)) : top,
  };
}

/**
 * Apply signatures using pdf-lib
 */
async function applySignaturesPdfLib(template, fields, signatureMap, viewport, log) {
  try {
    const pdfPath = resolveTemplatePdfPath(template);
    const pdfBytes = fs.readFileSync(pdfPath);
    const pdfDoc = await PDFLibDocument.load(pdfBytes);
    pdfDoc.registerFontkit(fontkit);

    for (const field of fields) {
      try {
        const pageIndex = Math.max(0, (field.pageNumber || 1) - 1);
        const page = pdfDoc.getPage(pageIndex);
        if (!page) continue;

        const { width: pageWidth, height: pageHeight } = page.getSize();
        const candidateKeys = [
          field.id,
          field.fieldId || field.fieldID || field.field_id || field.field || field.fieldName,
          `${field.pageNumber}:${field.recipientId}:${field.type}`,
          `${field.pageNumber}:${field.recipientId}`,
          `${field.recipientId}:${field.type}`,
          `${field.recipientId}`,
          `${field.pageNumber}-${field.recipientId}-${field.type}`,
        ].filter(Boolean).map(String);

        let signatureBuffer = null;
        for (const key of candidateKeys) {
          const buffer = signatureMap.get(key);
          if (buffer && buffer.length > 0) {
            signatureBuffer = buffer;
            break;
          }
        }

        if (!signatureBuffer && field.index != null) {
          signatureBuffer = signatureMap.get(`index:${field.index}`);
        }

        if (!signatureBuffer) {
          if (field.value && (field.type === "signature" || field.type === "initial" || field.type === "text")) {
            const dims = calculateFieldDimensions(field, pageWidth, pageHeight, viewport, field.pageNumber);
            try {
              const paddingX = Math.max(6, Math.round(dims.width * 0.06));
              const maxByHeight = Math.max(8, Math.min(Math.round(dims.height * 0.9), 200));

              let embeddedFont = null;
              const fontId = field.fontId;
              const fontsDir = path.join(__dirname, "..", "..", "fonts");
              let fontPath = path.join(fontsDir, `${fontId}.ttf`);
              if (!fontId || !fs.existsSync(fontPath)) {
                fontPath = path.join(fontsDir, `${String(fontId).replace(/-/g, "_")}.ttf`);
              }
              if (fontId && fs.existsSync(fontPath)) {
                const fontBytes = fs.readFileSync(fontPath);
                embeddedFont = await pdfDoc.embedFont(fontBytes);
              }

              let measureFont = embeddedFont || (await pdfDoc.embedFont(StandardFonts.Helvetica));
              let fontSize = Math.min(maxByHeight, 72);
              if (measureFont) {
                while (fontSize > 6) {
                  const textWidth = measureFont.widthOfTextAtSize(field.value, fontSize);
                  if (textWidth <= Math.max(1, dims.width - paddingX * 2)) break;
                  fontSize -= 1;
                }
              }

              let measuredWidth = measureFont ? measureFont.widthOfTextAtSize(field.value, fontSize) : null;
              const textX = measuredWidth ? dims.left + (dims.width - measuredWidth) / 2 : dims.left + 5;
              const textY = pageHeight - dims.top - (dims.height + fontSize) / 2;

              page.drawText(field.value, {
                x: textX,
                y: textY,
                size: fontSize,
                color: { type: "RGB", red: 0, green: 0, blue: 0 },
                font: embeddedFont || measureFont,
              });
            } catch (textError) {
              log.error(`Failed to draw text for field ${field.id}:`, textError.message);
            }
          }
          continue;
        }

        const dims = calculateFieldDimensions(field, pageWidth, pageHeight, viewport, field.pageNumber);
        let embeddedImage = null;
        try {
          embeddedImage = await pdfDoc.embedPng(signatureBuffer);
        } catch (pngError) {
          try {
            embeddedImage = await pdfDoc.embedJpg(signatureBuffer);
          } catch (jpgError) {
            // Potential conversion needed but skipping for brevity or add sharp if available
            log.warn(`Signature format not supported directly for field ${field.id}`);
            continue;
          }
        }

        const imgDims = embeddedImage.scale(1);
        const scale = Math.min(dims.width / imgDims.width, dims.height / imgDims.height);
        const drawWidth = imgDims.width * scale;
        const drawHeight = imgDims.height * scale;
        const xOffset = (dims.width - drawWidth) / 2;
        const yOffset = (dims.height - drawHeight) / 2;
        const x = dims.left + xOffset;
        const y = pageHeight - dims.top - drawHeight - yOffset;

        page.drawImage(embeddedImage, { x, y, width: drawWidth, height: drawHeight });
      } catch (fieldError) {
        log.error(`Error processing field ${field.id}:`, fieldError);
      }
    }

    const signedPdfBytes = await pdfDoc.save();
    const outputPath = getSignedPdfPath(template._id);
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
    fs.writeFileSync(outputPath, signedPdfBytes);
    return outputPath;
  } catch (error) {
    throw error;
  }
}

/**
 * Apply signatures to template
 */
export const applySignatures = async (request, reply) => {
  try {
    const { templateId } = request.params;
    const { signatures, fields: incomingFields, viewport, recipients, message } = request.body;

    if (!TemplateValidator.isValidObjectId(templateId)) {
      return reply.status(400).send({ success: false, message: "Invalid template ID" });
    }

    const template = await DocuSignTemplate.findById(templateId);
    if (!template) {
      return reply.status(404).send({ success: false, message: "Template not found" });
    }

    // Free-tier limit check
    const userId = request.user?.id;
    if (userId && String(template.createdBy) === String(userId)) {
      const activeSub = await Subscription.findOne({
        userId,
        status: "active",
        $or: [{ endDate: { $exists: false } }, { endDate: { $gt: new Date() } }],
      });

      if (!activeSub) {
        const signedCount = await DocuSignTemplate.countDocuments({
          createdBy: userId,
          status: "final",
          isArchived: { $ne: true },
        });

        const { signedLimit } = getFreeTierLimits();
        if (signedCount >= signedLimit && template.status !== "final") {
          return reply.status(403).send({
            success: false,
            code: "FREE_SIGN_LIMIT_REACHED",
            message: "Free plan signing limit reached. Upgrade your plan to sign more documents.",
          });
        }
      }
    }

    if (recipients && Array.isArray(recipients) && recipients.length > 0) {
      const User = (await import("../../models/User.js")).default;
      template.recipients = await Promise.all(recipients.map(async (r) => {
        const data = {
          id: r.id || `${Date.now()}-${Math.random()}`,
          name: r.name,
          email: r.email,
          signatureStatus: "pending",
          notifiedAt: new Date(),
        };
        if (r.email) {
          const user = await User.findOne({ email: r.email });
          if (user) data.userId = user._id;
        }
        return data;
      }));
    }

    if (message) {
      template.message = { subject: message.subject || "", body: message.body || "" };
    }

    const signatureMap = processSignatureData(signatures || []);
    const fieldsToUse = incomingFields?.length > 0
      ? FieldValidator.processBulkFields(incomingFields, viewport, template.metadata?.pages)
      : template.signatureFields || [];

    const outPath = await applySignaturesPdfLib(template, fieldsToUse, signatureMap, viewport, request.log);
    const pdfUrl = pathToUrl(outPath);
    template.finalPdfUrl = pdfUrl;
    template.status = "final";
    await template.save();

    // Update DocuSignDocument record
    try {
      const finalBuf = fs.readFileSync(outPath);
      const finalHash = crypto.createHash("sha256").update(finalBuf).digest("hex");
      let finalDoc = template.metadata?.document ? await DocuSignDocument.findById(template.metadata.document) : null;

      if (finalDoc) {
        finalDoc.finalPdfPath = template.finalPdfUrl;
        finalDoc.finalPdfHash = finalHash;
        finalDoc.finalPdfSize = finalBuf.length;
        finalDoc.status = "signed";
        await finalDoc.save();
      } else {
        finalDoc = await DocuSignDocument.create({
          fileId: `${template._id}-final`,
          filename: `${template._id}-final.pdf`,
          mimeType: "application/pdf",
          fileSize: finalBuf.length,
          originalPdfPath: template.metadata?.originalPdfPath || "",
          finalPdfPath: template.finalPdfUrl,
          fileHash: template.metadata?.fileHash,
          finalPdfHash: finalHash,
          finalPdfSize: finalBuf.length,
          status: "signed",
          template: template._id,
        });
        template.metadata = { ...template.metadata, document: finalDoc._id };
        await template.save();
      }
    } catch (err) {
      request.log.warn("Failed to update DocuSignDocument:", err.message);
    }

    await logDocuSignActivity(userId, "DOCUSIGN_TEMPLATE_SIGNED", `Signatures applied to: ${template.name}`, { templateId: template._id }, request);

    // Notifications
    if (template.recipients && template.recipients.length > 0) {
      try {
        const User = (await import("../../models/User.js")).default;
        const { notifyAllRecipients } = await import("../../services/NotificationService.js");
        const sender = await User.findById(userId);
        const senderName = sender ? `${sender.firstName} ${sender.lastName}`.trim() : "Someone";
        const appBaseUrl = process.env.FRONTEND_URL || `${request.protocol}://${request.hostname}`;
        await notifyAllRecipients({ template, senderName, appBaseUrl });
      } catch (notifyError) {
        request.log.error("Failed to send notifications:", notifyError.message);
      }
    }

    return {
      success: true,
      data: { templateId, finalPdfUrl: template.finalPdfUrl, message: "Signatures applied successfully" },
    };
  } catch (error) {
    request.log.error("Apply signatures error:", error);
    return reply.status(500).send({ success: false, message: error.message || "Failed to apply signatures" });
  }
};

/**
 * Get signed document
 */
export const getSignedDocument = async (request, reply) => {
  try {
    const { templateId } = request.params;
    const template = await DocuSignTemplate.findById(templateId);
    if (!template) return reply.status(404).send({ success: false, message: "Template not found" });
    if (template.status !== "final") return reply.status(400).send({ success: false, message: "Not signed yet" });

    let finalPdfInfo = null;
    if (template.finalPdfUrl) {
      const rel = template.finalPdfUrl.replace(/^\//, "");
      const absPath = path.join(__dirname, "..", "..", rel);
      if (fs.existsSync(absPath)) {
        const stats = fs.statSync(absPath);
        finalPdfInfo = { url: template.finalPdfUrl, size: stats.size, filename: path.basename(absPath) };
      }
    }

    return {
      success: true,
      data: {
        templateId: template._id,
        name: template.name,
        status: template.status,
        finalPdf: finalPdfInfo,
        createdAt: template.createdAt,
        updatedAt: template.updatedAt,
      },
    };
  } catch (error) {
    request.log.error("Get signed document error:", error);
    return reply.status(500).send({ success: false, message: "Failed to get signed document" });
  }
};

