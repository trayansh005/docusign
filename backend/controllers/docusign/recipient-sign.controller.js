import DocuSignTemplate from "../../models/DocuSignTemplate.js";
import DocuSignDocument from "../../models/DocuSignDocument.js";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { PDFDocument as PDFLibDocument, StandardFonts } from "pdf-lib";
import sharp from "sharp";
import { fileURLToPath } from "url";
import { resolveTemplatePdfPath, getSignedPdfPath } from "../../utils/pdfPathResolver.js";
import { logDocuSignActivity } from "../../services/ActivityService.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Resolve the correct PDF path to use (signed version or original)
 */
function resolvePdfPath(template) {
  const signedPath = getSignedPdfPath(String(template._id));
  if (fs.existsSync(signedPath)) return signedPath;
  return resolveTemplatePdfPath(template);
}

/**
 * Apply signatures to PDF using pdf-lib
 */
async function applySignaturesToPdf(template, signatures, log) {
  try {
    const pdfPath = resolvePdfPath(template);
    const pdfBytes = fs.readFileSync(pdfPath);
    const pdfDoc = await PDFLibDocument.load(pdfBytes);

    for (const sig of signatures) {
      try {
        const pageIndex = Math.max(0, (sig.pageNumber || 1) - 1);
        const page = pdfDoc.getPage(pageIndex);
        if (!page) continue;

        const { width: pageWidth, height: pageHeight } = page.getSize();
        let targetLeft, targetTop, targetWidth, targetHeight;

        if (sig.xPct != null && sig.yPct != null && sig.wPct != null && sig.hPct != null) {
          const xPct = Number(sig.xPct) > 1 ? Number(sig.xPct) / 100 : Number(sig.xPct);
          const yPct = Number(sig.yPct) > 1 ? Number(sig.yPct) / 100 : Number(sig.yPct);
          const wPct = Number(sig.wPct) > 1 ? Number(sig.wPct) / 100 : Number(sig.wPct);
          const hPct = Number(sig.hPct) > 1 ? Number(sig.hPct) / 100 : Number(sig.hPct);

          targetLeft = xPct * pageWidth;
          targetTop = yPct * pageHeight;
          targetWidth = wPct * pageWidth;
          targetHeight = hPct * pageHeight;
        } else if (sig.viewportWidth && sig.viewportHeight && sig.x != null && sig.y != null && sig.width != null && sig.height != null) {
          const vw = Number(sig.viewportWidth);
          const vh = Number(sig.viewportHeight);
          targetLeft = (Number(sig.x) / vw) * pageWidth;
          targetTop = (Number(sig.y) / vh) * pageHeight;
          targetWidth = (Number(sig.width) / vw) * pageWidth;
          targetHeight = (Number(sig.height) / vh) * pageHeight;
        } else if (sig.x != null && sig.y != null && sig.width != null && sig.height != null) {
          targetLeft = Number(sig.x);
          targetTop = Number(sig.y);
          targetWidth = Number(sig.width);
          targetHeight = Number(sig.height);
        } else continue;

        const isTextField = ["address", "email", "phone", "name", "text", "date"].includes(sig.type);

        if (isTextField) {
          const textValue = sig.signatureImageBuffer || "";
          if (!textValue || textValue.trim() === "") continue;

          const x = targetLeft;
          const y = pageHeight - targetTop - targetHeight;
          const fontSize = Math.max(Math.min(targetHeight * 0.6, 16), 8);
          const textX = x + 5;
          const textY = y + targetHeight / 2;

          page.drawText(textValue, {
            x: textX,
            y: textY,
            size: fontSize,
            color: { type: "RGB", red: 0, green: 0, blue: 0 },
          });
          continue;
        }

        let buffer = null;
        let plainText = null;
        const rawData = sig.signatureImageBuffer || sig.image || sig.dataUrl || sig.dataURL || sig.value || null;

        if (rawData) {
          if (Buffer.isBuffer(rawData)) buffer = rawData;
          else if (typeof rawData === "string") {
            const trimmed = rawData.trim();
            if (trimmed.startsWith("data:image")) {
              const base64Data = trimmed.replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, "");
              try { buffer = Buffer.from(base64Data, "base64"); } catch (e) {}
            } else if (trimmed.length > 0) plainText = trimmed;
          }
        }

        if (!buffer) {
          if (plainText && (sig.type === "signature" || sig.type === "initial")) {
            const fieldDef = (template.signatureFields || []).find((f) => f.id === sig.fieldId);
            const fontId = sig.fontId || fieldDef?.fontId;

            if (fieldDef) {
              const fxPct = fieldDef.xPct != null ? (Number(fieldDef.xPct) > 1 ? Number(fieldDef.xPct) / 100 : Number(fieldDef.xPct)) : null;
              const fyPct = fieldDef.yPct != null ? (Number(fieldDef.yPct) > 1 ? Number(fieldDef.yPct) / 100 : Number(fieldDef.yPct)) : null;
              const fwPct = fieldDef.wPct != null ? (Number(fieldDef.wPct) > 1 ? Number(fieldDef.wPct) / 100 : Number(fieldDef.wPct)) : null;
              const fhPct = fieldDef.hPct != null ? (Number(fieldDef.hPct) > 1 ? Number(fieldDef.hPct) / 100 : Number(fieldDef.hPct)) : null;

              if (fxPct != null && fyPct != null && fwPct != null && fhPct != null) {
                targetLeft = fxPct * pageWidth;
                targetTop = fyPct * pageHeight;
                targetWidth = fwPct * pageWidth;
                targetHeight = fhPct * pageHeight;
              }
            }

            const paddingX = Math.max(6, Math.round(targetWidth * 0.06));
            const maxByHeight = Math.max(8, Math.min(Math.round(targetHeight * 0.9), 200));

            let embeddedFont = null;
            const fontsDir = path.join(__dirname, "..", "..", "fonts");
            let fontPath = path.join(fontsDir, `${fontId}.ttf`);
            if (!fontId || !fs.existsSync(fontPath)) fontPath = path.join(fontsDir, `${String(fontId).replace(/-/g, "_")}.ttf`);

            if (fontId && fs.existsSync(fontPath)) {
              const fontBytes = fs.readFileSync(fontPath);
              embeddedFont = await pdfDoc.embedFont(fontBytes);
            }

            let measureFont = embeddedFont || (await pdfDoc.embedFont(StandardFonts.Helvetica));
            let fontSize = Math.min(maxByHeight, 72);
            if (measureFont) {
              while (fontSize > 6) {
                if (measureFont.widthOfTextAtSize(plainText, fontSize) <= Math.max(1, targetWidth - paddingX * 2)) break;
                fontSize -= 1;
              }
              fontSize = Math.min(fontSize, Math.max(8, Math.round(targetHeight * 0.6)));
            }

            const measuredWidth = measureFont ? measureFont.widthOfTextAtSize(plainText, fontSize) : null;
            const textX = measuredWidth ? targetLeft + (targetWidth - measuredWidth) / 2 : targetLeft + 5;
            const textY = pageHeight - targetTop - (targetHeight + fontSize) / 2;

            page.drawText(plainText, {
              x: textX,
              y: textY,
              size: fontSize,
              color: { type: "RGB", red: 0, green: 0, blue: 0 },
              font: embeddedFont || (await pdfDoc.embedFont(StandardFonts.Helvetica)),
            });
          }
          continue;
        }

        let embeddedImage = null;
        try { embeddedImage = await pdfDoc.embedPng(buffer); }
        catch (e) {
          try { embeddedImage = await pdfDoc.embedJpg(buffer); }
          catch (e2) {
            try {
              const coerced = await sharp(buffer).png().toBuffer();
              embeddedImage = await pdfDoc.embedPng(coerced);
            } catch (e3) { continue; }
          }
        }

        const imgDims = embeddedImage.scale(1);
        const scale = Math.min(targetWidth / imgDims.width, targetHeight / imgDims.height);
        const drawWidth = Math.max(1, imgDims.width * scale);
        const drawHeight = Math.max(1, imgDims.height * scale);
        const x = targetLeft;
        const y = pageHeight - targetTop - drawHeight;

        page.drawImage(embeddedImage, { x, y, width: drawWidth, height: drawHeight });
      } catch (e) { log.error(`Error processing signature:`, e); }
    }

    const outPath = getSignedPdfPath(String(template._id));
    const outputDir = path.dirname(outPath);
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
    fs.writeFileSync(outPath, Buffer.from(await pdfDoc.save()));
    return outPath;
  } catch (error) { throw error; }
}

/**
 * Unified document signing endpoint for both recipients and senders
 */
export const recipientSignDocument = async (request, reply) => {
  try {
    const { templateId } = request.params;
    const { signatures, placeholderFields, recipients, message } = request.body;
    const userId = request.user?.id || request.user?._id;
    const userEmail = request.user?.email;

    const hasSignatures = Array.isArray(signatures) && signatures.length > 0;
    const hasPlaceholders = Array.isArray(placeholderFields) && placeholderFields.length > 0;

    if (!hasSignatures && !hasPlaceholders) {
      return reply.status(400).send({ success: false, error: "Either signatures or placeholder fields are required" });
    }

    const template = await DocuSignTemplate.findById(templateId);
    if (!template) return reply.status(404).send({ success: false, error: "Template not found" });

    const myRecipient = template.recipients?.find(r => r.email === userEmail || r.userId?.toString() === userId?.toString());
    let isTemplateOwner = false;

    if (!myRecipient) {
      const ownerId = template.userId?.toString() || template.createdBy?.toString();
      isTemplateOwner = ownerId === userId?.toString();
      if (!isTemplateOwner) return reply.status(403).send({ success: false, error: "Not authorized" });
    }

    if (myRecipient?.signatureStatus === "signed") {
      return reply.status(400).send({ success: false, error: "Already signed" });
    }

    if (isTemplateOwner) {
      try {
        const Subscription = (await import("../../models/Subscription.js")).default;
        const { getFreeTierLimits } = await import("../../utils/freeTierLimits.js");
        const activeSub = await Subscription.findOne({
          userId,
          status: "active",
          $or: [{ endDate: { $exists: false } }, { endDate: { $gt: new Date() } }],
        });

        if (!activeSub) {
          const signedCount = await DocuSignTemplate.countDocuments({ createdBy: userId, status: "final", isArchived: { $ne: true } });
          const { signedLimit } = getFreeTierLimits();
          if (signedCount >= signedLimit && template.status !== "final") {
            return reply.status(403).send({ success: false, code: "FREE_SIGN_LIMIT_REACHED", message: "Limit reached" });
          }
        }
      } catch (e) { request.log.error("Limit check failed:", e); }
    }

    if (hasPlaceholders) {
      const validTypes = ["signature", "date", "initial", "text", "name", "email", "phone", "address"];
      const newFields = placeholderFields.map(f => ({
        id: f.id,
        recipientId: "placeholder",
        type: validTypes.includes(f.type) ? f.type : "signature",
        pageNumber: f.pageNumber,
        xPct: (f.xPct || 0) / 100,
        yPct: (f.yPct || 0) / 100,
        wPct: (f.wPct || 20) / 100,
        hPct: (f.hPct || 5) / 100,
        required: f.required || false,
        placeholder: true,
        placeholderText: f.placeholderText,
      }));
      template.signatureFields = [...(template.signatureFields || []), ...newFields];
    }

    if (template.signatureFields) {
      template.signatureFields = template.signatureFields.map(f => ({
        ...f,
        xPct: f.xPct > 1 ? f.xPct / 100 : f.xPct,
        yPct: f.yPct > 1 ? f.yPct / 100 : f.yPct,
        wPct: f.wPct > 1 ? f.wPct / 100 : f.wPct,
        hPct: f.hPct > 1 ? f.hPct / 100 : f.hPct,
      }));
    }

    if (Array.isArray(recipients) && recipients.length > 0) {
      const User = (await import("../../models/User.js")).default;
      template.recipients = await Promise.all(recipients.map(async (r, i) => {
        const data = {
          id: r.id || `${Date.now()}-${Math.random()}`,
          name: r.name,
          email: r.email,
          signatureStatus: i === 0 ? "pending" : "waiting",
          signingOrder: r.signingOrder || i + 1,
          notifiedAt: new Date(),
          eligibleAt: i === 0 ? new Date() : null,
        };
        if (r.email) {
          const user = await User.findOne({ email: r.email });
          if (user) data.userId = user._id;
        }
        return data;
      }));
      template.updateSigningStatus();
    }

    if (message) template.message = { subject: message.subject || "", body: message.body || "" };

    const signedPdfPath = hasSignatures ? await applySignaturesToPdf(template, signatures, request.log) : resolveTemplatePdfPath(template);

    if (hasSignatures) {
      const pdfUrl = signedPdfPath.replace(path.join(__dirname, "..", ".."), "").replace(/\\/g, "/");
      template.finalPdfUrl = pdfUrl.startsWith("/") ? pdfUrl : `/${pdfUrl}`;
    }

    if (!isTemplateOwner) {
      const r = template.recipients.find(rec => rec.email === userEmail || rec.userId?.toString() === userId?.toString());
      if (r) {
        r.signatureStatus = "signed";
        r.signedAt = new Date();
        await logDocuSignActivity(userId, "DOCUSIGN_DOCUMENT_SIGNED", `Signed by: ${r.name}`, { templateId: template._id }, request);
        template.updateSigningStatus();
      }
    } else {
      await logDocuSignActivity(userId, "DOCUSIGN_DOCUMENT_SIGNED", `Signed by owner`, { templateId: template._id }, request);
    }

    if (template.recipients.every(r => r.signatureStatus === "signed")) template.status = "final";

    if (fs.existsSync(signedPdfPath)) {
      try {
        const buf = fs.readFileSync(signedPdfPath);
        const hash = crypto.createHash("sha256").update(buf).digest("hex");
        if (template.metadata?.document) {
          const doc = await DocuSignDocument.findById(template.metadata.document);
          if (doc) {
            doc.finalPdfPath = template.finalPdfUrl;
            doc.finalPdfHash = hash;
            doc.finalPdfSize = buf.length;
            doc.status = "signed";
            await doc.save();
          }
        }
      } catch (e) { request.log.error("Document update failed:", e); }
    }

    await template.save();

    return {
      success: true,
      message: "Signed successfully",
      data: {
        template,
        recipientStatus: isTemplateOwner ? null : template.recipients.find(r => r.email === userEmail || r.userId?.toString() === userId?.toString()),
        allSigned: template.status === "final",
        signerType: isTemplateOwner ? "owner" : "recipient",
      },
    };
  } catch (error) {
    request.log.error("Unified sign error:", error);
    return reply.status(500).send({ success: false, error: "Failed to save signatures", details: error.message });
  }
};

