import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";
import { PDFDocument as PDFLibDocument } from "pdf-lib";
import DocuSignTemplate from "../../models/DocuSignTemplate.js";
import DocuSignDocument from "../../models/DocuSignDocument.js";
import { logDocuSignActivity } from "../../services/ActivityService.js";
import { TemplateValidator } from "../../validators/TemplateValidator.js";
import { FieldValidator } from "../../validators/FieldValidator.js";
import { resolveTemplatePdfPath, getSignedPdfPath, pathToUrl } from "../../utils/pdfPathResolver.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE_DIR = path.join(__dirname, "../../uploads/signatures");
const TEMPLATES_DIR = path.join(BASE_DIR, "templates");

/**
 * Process signature data from request
 */
function processSignatureData(signatures) {
	const signatureMap = {};

	for (const sig of signatures) {
		const key = `${sig.pageNumber}-${sig.recipientId}-${sig.type}`;
		
		// Handle signature image buffer
		if (sig.signatureImageBuffer) {
			if (typeof sig.signatureImageBuffer === "string") {
				// Base64 string
				const base64Data = sig.signatureImageBuffer.replace(/^data:image\/\w+;base64,/, "");
				signatureMap[key] = Buffer.from(base64Data, "base64");
			} else if (Buffer.isBuffer(sig.signatureImageBuffer)) {
				signatureMap[key] = sig.signatureImageBuffer;
			}
		}

		// Store signature metadata
		signatureMap[`${key}_metadata`] = {
			pageNumber: sig.pageNumber,
			recipientId: sig.recipientId,
			type: sig.type,
			x: sig.x,
			y: sig.y,
			width: sig.width,
			height: sig.height,
		};
	}

	return signatureMap;
}

/**
 * Apply signatures using pdf-lib (direct PDF manipulation)
 */
async function applySignaturesPdfLib(template, fields, signatureMap, viewport) {
	try {
		// Resolve path to original PDF
		const pdfPath = resolveTemplatePdfPath(template);
		console.log(`Loading PDF from: ${pdfPath}`);

		// Load the PDF
		const pdfBytes = fs.readFileSync(pdfPath);
		const pdfDoc = await PDFLibDocument.load(pdfBytes);

		// Process each signature field
		for (const field of fields) {
			const key = `${field.pageNumber}-${field.recipientId}-${field.type}`;
			const signatureBuffer = signatureMap[key];

			if (!signatureBuffer) {
				console.warn(`No signature found for field ${field.id} (${key})`);
				continue;
			}

			try {
				const page = pdfDoc.getPage(field.pageNumber - 1);
				const { width: pageWidth, height: pageHeight } = page.getSize();

				// Calculate position using normalized coordinates if available, else pixels
				let x, y, width, height;

				if (field.xPct !== undefined && field.yPct !== undefined) {
					// Use normalized coordinates (preferred)
					x = field.xPct * pageWidth;
					y = pageHeight - (field.yPct * pageHeight) - (field.hPct * pageHeight);
					width = field.wPct * pageWidth;
					height = field.hPct * pageHeight;
				} else {
					// Fallback to pixel coordinates
					// Need viewport to convert pixels to PDF space
					const viewportInfo = viewport?.[field.pageNumber];
					if (viewportInfo) {
						const scaleX = pageWidth / viewportInfo.width;
						const scaleY = pageHeight / viewportInfo.height;
						x = field.x * scaleX;
						y = pageHeight - (field.y * scaleY) - (field.height * scaleY);
						width = field.width * scaleX;
						height = field.height * scaleY;
					} else {
						// No viewport, use pixel values directly (may be incorrect)
						console.warn(`No viewport info for page ${field.pageNumber}, using pixel values directly`);
						x = field.x;
						y = pageHeight - field.y - field.height;
						width = field.width;
						height = field.height;
					}
				}

				// Embed the signature image
				let embeddedImage;
				try {
					embeddedImage = await pdfDoc.embedPng(signatureBuffer);
				} catch (pngError) {
					// Try JPEG if PNG fails
					try {
						embeddedImage = await pdfDoc.embedJpg(signatureBuffer);
					} catch (jpgError) {
						console.error(`Failed to embed signature for field ${field.id}:`, jpgError);
						continue;
					}
				}

				// Draw the signature on the page
				page.drawImage(embeddedImage, {
					x,
					y,
					width,
					height,
				});

				console.log(`Applied signature for field ${field.id} on page ${field.pageNumber}`);
			} catch (fieldError) {
				console.error(`Error processing field ${field.id}:`, fieldError);
			}
		}

		// Save the modified PDF
		const signedPdfBytes = await pdfDoc.save();
		const outputPath = getSignedPdfPath(template._id);

		fs.writeFileSync(outputPath, signedPdfBytes);
		console.log(`Saved signed PDF to: ${outputPath}`);

		return outputPath;
	} catch (error) {
		console.error("Error applying signatures with pdf-lib:", error);
		throw error;
	}
}

/**
 * Apply signatures to template
 */
export const applySignatures = async (req, res) => {
	try {
		const { templateId } = req.params;
		const { signatures, fields: incomingFields, viewport } = req.body;

		if (!TemplateValidator.isValidObjectId(templateId)) {
			return res.status(400).json({ success: false, message: "Invalid template ID" });
		}

		const template = await DocuSignTemplate.findById(templateId);
		if (!template) {
			return res.status(404).json({ success: false, message: "Template not found" });
		}

		const signatureMap = processSignatureData(signatures || []);
		const fieldsToUse =
			incomingFields?.length > 0
				? FieldValidator.processBulkFields(incomingFields, viewport, template.metadata?.pages)
				: template.signatureFields || [];

		// Use pdf-lib to embed signatures directly into the original PDF
		const outPath = await applySignaturesPdfLib(template, fieldsToUse, signatureMap, viewport);
		if (!outPath || !fs.existsSync(outPath)) {
			throw new Error("PDF embedding failed or produced no output");
		}

		// Update template metadata
		const pdfUrl = pathToUrl(outPath);
		template.finalPdfUrl = pdfUrl;
		template.status = "final";

		await template.save();

		// Persist final signed PDF as a DocuSignDocument
		try {
			const finalBuf = fs.readFileSync(outPath);
			const finalHash = crypto.createHash("sha256").update(finalBuf).digest("hex");

			let finalDoc = await DocuSignDocument.findOne({ fileHash: finalHash });
			if (!finalDoc) {
				finalDoc = await DocuSignDocument.create({
					fileId: `${template._id}-final`,
					filename: `${template._id}-final.pdf`,
					mimeType: "application/pdf",
					fileSize: finalBuf.length,
					originalPdfPath: template.finalPdfUrl,
					fileHash: finalHash,
					status: "ready",
				});
			} else {
				finalDoc.originalPdfPath = template.finalPdfUrl;
				await finalDoc.save();
			}

			template.metadata = template.metadata || {};
			template.metadata.finalDocument = finalDoc._id;
			await template.save();
		} catch (err) {
			console.warn("Failed to persist final DocuSignDocument:", err.message);
		}

		await logDocuSignActivity(
			req.user?.id,
			"DOCUSIGN_TEMPLATE_SIGNED",
			`Signatures applied to DocuSign template: ${template.name}`,
			{ templateId: template._id, name: template.name, signatureCount: signatures?.length || 0 },
			req
		);

		return res.status(200).json({
			success: true,
			data: {
				templateId,
				finalPdfUrl: template.finalPdfUrl,
				message: "Signatures applied successfully",
			},
		});
	} catch (error) {
		console.error("Apply signatures error:", error);
		return res.status(500).json({
			success: false,
			message: error.message || "Failed to apply signatures",
		});
	}
};

/**
 * Get signed document
 */
export const getSignedDocument = async (req, res) => {
	try {
		const { templateId } = req.params;

		if (!TemplateValidator.isValidObjectId(templateId)) {
			return res.status(400).json({
				success: false,
				message: "Invalid template ID",
			});
		}

		const template = await DocuSignTemplate.findById(templateId);
		if (!template) {
			return res.status(404).json({
				success: false,
				message: "Template not found",
			});
		}

		if (template.status !== "final") {
			return res.status(400).json({
				success: false,
				message: "Template has not been signed yet",
			});
		}

		let finalPdfInfo = null;
		if (template.finalPdfUrl) {
			try {
				const rel = template.finalPdfUrl.replace(/^\//, "");
				const absPath = path.join(__dirname, "..", "..", rel);

				if (fs.existsSync(absPath)) {
					const stats = fs.statSync(absPath);
					finalPdfInfo = {
						url: template.finalPdfUrl,
						size: stats.size,
						filename: path.basename(absPath),
					};
				}
			} catch (err) {
				console.warn("Failed to stat final PDF:", err.message);
			}
		}

		return res.status(200).json({
			success: true,
			data: {
				templateId: template._id,
				name: template.name,
				status: template.status,
				finalPdf: finalPdfInfo,
				signedPages: [], // Legacy compatibility
				createdAt: template.createdAt,
				updatedAt: template.updatedAt,
			},
		});
	} catch (error) {
		console.error("Get signed document error:", error);
		return res.status(500).json({
			success: false,
			message: error.message || "Failed to get signed document",
		});
	}
};
