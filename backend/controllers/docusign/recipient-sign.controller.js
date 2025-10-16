import DocuSignTemplate from "../../models/DocuSignTemplate.js";
import DocuSignDocument from "../../models/DocuSignDocument.js";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { PDFDocument as PDFLibDocument } from "pdf-lib";
import sharp from "sharp";
import { fileURLToPath } from "url";
import { resolveTemplatePdfPath, getSignedPdfPath } from "../../utils/pdfPathResolver.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Paths are resolved via pdfPathResolver helpers; no local base dir needed

/**
 * Resolve the correct PDF path to use (signed version or original)
 * Mirrors RSSC's approach for sequential signing
 */
function resolvePdfPath(template) {
	// Prefer an existing signed PDF
	const signedPath = getSignedPdfPath(String(template._id));
	if (fs.existsSync(signedPath)) {
		// Using existing signed PDF for sequential signing
		return signedPath;
	}
	// Otherwise use the original template PDF via shared resolver
	const original = resolveTemplatePdfPath(template);
	// Using original template PDF as base
	return original;
}

/**
 * Apply signatures to PDF using pdf-lib (mirrors RSSC approach)
 * Uses absolute pixel coordinates from frontend, not percentage-based schema fields
 */
async function applySignaturesToPdf(template, signatures) {
	try {
		// Process signature images and embed into PDF

		// Get the correct PDF (sequential signing support)
		const pdfPath = resolvePdfPath(template);
		const pdfBytes = fs.readFileSync(pdfPath);
		const pdfDoc = await PDFLibDocument.load(pdfBytes);

		// Process each signature
		for (const sig of signatures) {
			try {
				const pageIndex = Math.max(0, (sig.pageNumber || 1) - 1);
				const page = pdfDoc.getPage(pageIndex);
				if (!page) {
					console.warn(`[ApplySignatures] Page ${sig.pageNumber} not found`);
					continue;
				}

				const { width: pageWidth, height: pageHeight } = page.getSize();
				// Page size available: pageWidth x pageHeight

				// Determine target rectangle in PDF coordinates
				// Support three cases:
				// A) Percentages provided (xPct,yPct,wPct,hPct) -> map directly to page dimensions
				// B) Absolute viewer pixels with viewport (viewportWidth/Height) -> scale to page
				// C) Raw pixels assumed already in PDF space (fallback)

				let targetLeft = 0;
				let targetTop = 0; // distance from top
				let targetWidth = 0;
				let targetHeight = 0;

				if (sig.xPct != null && sig.yPct != null && sig.wPct != null && sig.hPct != null) {
					// A) Percentage-based
					targetLeft = (Number(sig.xPct) / 100) * pageWidth;
					targetTop = (Number(sig.yPct) / 100) * pageHeight;
					targetWidth = (Number(sig.wPct) / 100) * pageWidth;
					targetHeight = (Number(sig.hPct) / 100) * pageHeight;
					// Using percentage-based coordinates
				} else if (
					sig.viewportWidth &&
					sig.viewportHeight &&
					sig.x != null &&
					sig.y != null &&
					sig.width != null &&
					sig.height != null
				) {
					// B) Viewer pixels + viewport -> scale to page
					const vw = Number(sig.viewportWidth);
					const vh = Number(sig.viewportHeight);
					targetLeft = (Number(sig.x) / vw) * pageWidth;
					targetTop = (Number(sig.y) / vh) * pageHeight;
					targetWidth = (Number(sig.width) / vw) * pageWidth;
					targetHeight = (Number(sig.height) / vh) * pageHeight;
					// Using viewport-scaled coordinates
				} else if (sig.x != null && sig.y != null && sig.width != null && sig.height != null) {
					// C) Assume already in PDF space (best-effort)
					targetLeft = Number(sig.x);
					targetTop = Number(sig.y);
					targetWidth = Number(sig.width);
					targetHeight = Number(sig.height);
					// Using raw pixel coordinates (fallback)
				} else {
					console.warn("[ApplySignatures] Insufficient coordinate data for signature; skipping");
					continue;
				}

				// Extract base64 image data
				let buffer = null;
				if (sig.signatureImageBuffer && typeof sig.signatureImageBuffer === "string") {
					const base64Data = sig.signatureImageBuffer.replace(
						/^data:image\/[a-zA-Z0-9+.-]+;base64,/,
						""
					);
					buffer = Buffer.from(base64Data, "base64");
					// Signature image buffer created
				}

				if (!buffer) {
					console.warn(`[ApplySignatures] No valid signature data for field ${sig.fieldId}`);
					continue;
				}

				// Embed image (try PNG first, fallback to JPG, then convert via sharp)
				let embeddedImage = null;
				try {
					embeddedImage = await pdfDoc.embedPng(buffer);
				} catch (pngErr) {
					try {
						embeddedImage = await pdfDoc.embedJpg(buffer);
					} catch (jpgErr) {
						try {
							const coerced = await sharp(buffer).png().toBuffer();
							embeddedImage = await pdfDoc.embedPng(coerced);
						} catch (convErr) {
							console.warn(`[ApplySignatures] Failed to embed image:`, convErr.message);
							continue;
						}
					}
				}

				// Calculate final draw dimensions (preserve aspect ratio) within target box
				const imgDims = embeddedImage.scale(1);
				const scaleX = targetWidth / imgDims.width;
				const scaleY = targetHeight / imgDims.height;
				const scale = Math.min(scaleX, scaleY);

				const drawWidth = Math.max(1, imgDims.width * scale);
				const drawHeight = Math.max(1, imgDims.height * scale);

				// Convert from top-based coordinates to PDF bottom-left origin
				const x = targetLeft;
				const y = pageHeight - targetTop - drawHeight;

				// Drawing image in computed box

				page.drawImage(embeddedImage, {
					x,
					y,
					width: drawWidth,
					height: drawHeight,
				});

				// Signature embedded for this field
			} catch (fieldError) {
				console.error(`[ApplySignatures] Error processing signature:`, fieldError);
				continue;
			}
		}

		// Write signed PDF
		const outPath = getSignedPdfPath(String(template._id));
		const outputDir = path.dirname(outPath);
		if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
		const outBytes = await pdfDoc.save();
		fs.writeFileSync(outPath, Buffer.from(outBytes));

		// PDF saved at outPath
		return outPath;
	} catch (error) {
		console.error("[ApplySignatures] Error:", error);
		throw error;
	}
}

/**
 * Recipient signs the document by submitting signature images
 * Mirrors RSSC's approach: uses absolute pixel coordinates, not schema percentage fields
 * POST /api/docusign/:templateId/sign
 */
export const recipientSignDocument = async (req, res) => {
	try {
		const { templateId } = req.params;
		const { signatures } = req.body; // Array of signature data with pixel coordinates
		const userId = req.user?.id || req.user?._id;
		const userEmail = req.user?.email;

		// Recipient signing request

		// Validate input
		if (!signatures || !Array.isArray(signatures) || signatures.length === 0) {
			return res.status(400).json({
				success: false,
				error: "signatures array is required",
			});
		}

		// Find the template
		const template = await DocuSignTemplate.findById(templateId);
		if (!template) {
			return res.status(404).json({
				success: false,
				error: "Template not found",
			});
		}

		// Check if user is a recipient
		const myRecipient = template.recipients?.find(
			(r) => r.email === userEmail || r.userId?.toString() === userId?.toString()
		);

		if (!myRecipient) {
			return res.status(403).json({
				success: false,
				error: "You are not authorized to sign this document",
			});
		}

		// Check if already signed
		if (myRecipient.signatureStatus === "signed") {
			return res.status(400).json({
				success: false,
				error: "You have already signed this document",
			});
		}

		// Apply signatures to PDF (RSSC approach: direct pixel coordinates)
		// Applying signatures to PDF
		const signedPdfPath = await applySignaturesToPdf(template, signatures);

		// Update template with signed PDF URL
		const pdfUrl = signedPdfPath.replace(path.join(__dirname, "..", ".."), "").replace(/\\/g, "/");
		template.finalPdfUrl = pdfUrl.startsWith("/") ? pdfUrl : `/${pdfUrl}`;

		// Update recipient status
		const recipientIndex = template.recipients.findIndex(
			(r) => r.email === userEmail || r.userId?.toString() === userId?.toString()
		);

		if (recipientIndex !== -1) {
			template.recipients[recipientIndex].signatureStatus = "signed";
			template.recipients[recipientIndex].signedAt = new Date();
		}

		// Check if all recipients have signed
		const allRecipientsSigned = template.recipients.every((r) => r.signatureStatus === "signed");
		if (allRecipientsSigned) {
			template.status = "final";
			console.log(`[RecipientSign] All recipients signed! Document marked as final.`);
		}

		// Update DocuSignDocument with final PDF info
		try {
			if (fs.existsSync(signedPdfPath)) {
				const finalBuf = fs.readFileSync(signedPdfPath);
				const finalHash = crypto.createHash("sha256").update(finalBuf).digest("hex");

				if (template.metadata?.document) {
					const finalDoc = await DocuSignDocument.findById(template.metadata.document);
					if (finalDoc) {
						finalDoc.finalPdfPath = template.finalPdfUrl;
						finalDoc.finalPdfHash = finalHash;
						finalDoc.finalPdfSize = finalBuf.length;
						finalDoc.status = "signed";
						await finalDoc.save();
						// Updated DocuSignDocument with final details
					}
				}
			}
		} catch (docError) {
			console.error("[RecipientSign] Failed to update DocuSignDocument:", docError);
			// Don't fail the entire request
		}

		// Save the template
		await template.save();

		// Sign process completed for user

		res.json({
			success: true,
			message: "Document signed successfully",
			data: {
				template,
				recipientStatus: template.recipients[recipientIndex],
				allSigned: allRecipientsSigned,
			},
		});
	} catch (error) {
		console.error("[RecipientSign] Error:", error);
		res.status(500).json({
			success: false,
			error: "Failed to save signatures",
			details: error.message,
		});
	}
};
