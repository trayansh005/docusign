import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";
import { PDFDocument as PDFLibDocument } from "pdf-lib";
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

const BASE_DIR = path.join(__dirname, "../../uploads/signatures");
const TEMPLATES_DIR = path.join(BASE_DIR, "templates");

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

			// Support multiple formats for signature image data
			const rawData =
				signature.signatureImageBuffer || signature.image || signature.dataUrl || signature.dataURL;



			if (typeof rawData === "string") {
				// Handle base64 data URLs
				const base64Data = rawData.trim().replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, "");
				if (base64Data) {
					buffer = Buffer.from(base64Data, "base64");
				}
			} else if (Buffer.isBuffer(rawData)) {
				buffer = rawData;
			}

			if (buffer) {
				// Create multiple keys for flexible lookup
				const keys = [
					signature.id,
					signature.fieldId ||
					signature.fieldID ||
					signature.field_id ||
					signature.field ||
					signature.fieldName,
					`${signature.pageNumber}:${signature.recipientId}:${signature.type}`,
					`${signature.pageNumber}:${signature.recipientId}`,
					`${signature.recipientId}:${signature.type}`,
					`${signature.recipientId}`,
					// Legacy key format for backward compatibility
					`${signature.pageNumber}-${signature.recipientId}-${signature.type}`,
				].filter(Boolean);

				// Store buffer under all keys
				keys.forEach((key) => signatureMap.set(String(key), buffer));

				// Also store under numeric index if provided
				if (signature.index != null) {
					signatureMap.set(`index:${signature.index}`, buffer);
				}

				console.log(`Stored signature under ${keys.length} keys for lookup flexibility`);
			}
		} catch (error) {
			console.warn("Failed to process signature:", error.message);
		}
	}

	console.log(`Processed ${signatureMap.size} signature entries`);
	return signatureMap;
}

/**
 * Calculate field dimensions and position with smart viewport estimation
 */
function calculateFieldDimensions(field, pageWidth, pageHeight, viewport, pageNumber) {
	const defaultWidth = 160;
	const defaultHeight = 48;

	// Smart viewport detection - try multiple sources
	const vp = viewport?.[pageNumber] || viewport?.[String(pageNumber)] || {};
	let baseW = field.viewportWidth || field.uiWidth || vp?.width;
	let baseH = field.viewportHeight || field.uiHeight || vp?.height;

	// If no viewport info, estimate from page aspect ratio
	if (!baseW || !baseH) {
		const pageAspectRatio = pageWidth && pageHeight ? pageWidth / pageHeight : 1.414; // A4 default

		if (pageAspectRatio > 1.5) {
			// Landscape orientation
			baseW = 1000;
			baseH = Math.round(1000 / pageAspectRatio);
		} else {
			// Portrait orientation (most common)
			baseW = 800;
			baseH = Math.round(800 / pageAspectRatio);
		}
		console.log(
			`Estimated viewport for page ${pageNumber}: ${baseW}x${baseH} (aspect: ${pageAspectRatio.toFixed(
				2
			)})`
		);
	}

	// Calculate normalized coordinates if not present
	const xPct =
		field.xPct != null ? field.xPct : baseW && field.x != null ? (field.x / baseW) * 100 : 0;
	const yPct =
		field.yPct != null ? field.yPct : baseH && field.y != null ? (field.y / baseH) * 100 : 0;
	const wPct =
		field.wPct != null
			? field.wPct
			: baseW && field.width != null
				? (field.width / baseW) * 100
				: undefined;
	const hPct =
		field.hPct != null
			? field.hPct
			: baseH && field.height != null
				? (field.height / baseH) * 100
				: undefined;

	// Calculate final pixel dimensions
	const targetWidth = Math.max(
		1,
		Math.round(wPct != null && pageWidth ? (wPct / 100) * pageWidth : field.width || defaultWidth)
	);
	const targetHeight = Math.max(
		1,
		Math.round(
			hPct != null && pageHeight ? (hPct / 100) * pageHeight : field.height || defaultHeight
		)
	);
	const left = Math.max(
		0,
		Math.round(xPct != null && pageWidth ? (xPct / 100) * pageWidth : field.x || 0)
	);
	const top = Math.max(
		0,
		Math.round(yPct != null && pageHeight ? (yPct / 100) * pageHeight : field.y || 0)
	);

	// Clamp to page boundaries to prevent fields from going off-page
	return {
		width: targetWidth,
		height: targetHeight,
		left: pageWidth ? Math.min(left, Math.max(0, pageWidth - targetWidth)) : left,
		top: pageHeight ? Math.min(top, Math.max(0, pageHeight - targetHeight)) : top,
	};
}

/**
 * Apply signatures using pdf-lib (direct PDF manipulation) with enhanced image handling
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
			try {
				const pageIndex = Math.max(0, (field.pageNumber || 1) - 1);
				const page = pdfDoc.getPage(pageIndex);
				if (!page) {
					console.warn(`Page ${field.pageNumber} not found in PDF`);
					continue;
				}

				// Get page dimensions
				const { width: pageWidth, height: pageHeight } = page.getSize();

				// Try multiple keys for signature lookup
				const candidateKeys = [
					field.id,
					field.fieldId || field.fieldID || field.field_id || field.field || field.fieldName,
					`${field.pageNumber}:${field.recipientId}:${field.type}`,
					`${field.pageNumber}:${field.recipientId}`,
					`${field.recipientId}:${field.type}`,
					`${field.recipientId}`,
					// Legacy format
					`${field.pageNumber}-${field.recipientId}-${field.type}`,
				]
					.filter(Boolean)
					.map(String);



				let signatureBuffer = null;
				for (const key of candidateKeys) {
					const buffer = signatureMap.get(key);
					if (buffer && buffer.length > 0) {
						signatureBuffer = buffer;
						console.log(`Found signature for field ${field.id} using key: ${key}`);
						break;
					}
				}

				// Try index-based lookup as fallback
				if (!signatureBuffer && field.index != null) {
					signatureBuffer = signatureMap.get(`index:${field.index}`);
					if (signatureBuffer) {
						console.log(`Found signature for field ${field.id} using index: ${field.index}`);
					}
				}

				if (!signatureBuffer) {
					console.warn(
						`No signature found for field ${field.id || field.fieldId} (tried ${candidateKeys.length
						} keys)`
					);

					// If there's a field.value, try to draw it as text instead of skipping
					if (
						field.value &&
						(field.type === "signature" || field.type === "initial" || field.type === "text")
					) {
						console.log(`Drawing text-based signature for field ${field.id}: "${field.value}"`);

						// Calculate field dimensions
						const dims = calculateFieldDimensions(
							field,
							pageWidth,
							pageHeight,
							viewport,
							field.pageNumber
						);

						// Draw text in the field
						const fontSize = Math.min(dims.height * 0.6, (dims.width / field.value.length) * 1.5);

						// For signature/initial fields, use a script-like font if available
						// For text fields, use standard font
						try {
							page.drawText(field.value, {
								x: dims.left + 5,
								y: pageHeight - dims.top - dims.height / 2 - fontSize / 3,
								size: fontSize,
								color: { type: "RGB", red: 0, green: 0, blue: 0 },
							});
							console.log(`Drew text signature "${field.value}" for field ${field.id}`);
						} catch (textError) {
							console.error(`Failed to draw text for field ${field.id}:`, textError.message);
						}
					}

					continue;
				}

				// Calculate field dimensions using smart calculator
				const dims = calculateFieldDimensions(
					field,
					pageWidth,
					pageHeight,
					viewport,
					field.pageNumber
				); // Try to embed the signature image with format detection and Sharp conversion
				let embeddedImage = null;
				try {
					embeddedImage = await pdfDoc.embedPng(signatureBuffer);
					console.log(`Embedded PNG signature for field ${field.id}`);
				} catch (pngError) {
					try {
						embeddedImage = await pdfDoc.embedJpg(signatureBuffer);
						console.log(`Embedded JPG signature for field ${field.id}`);
					} catch (jpgError) {
						// Try to convert using Sharp to PNG
						try {
							console.log(`Converting image format using Sharp for field ${field.id}`);
							const convertedBuffer = await sharp(signatureBuffer).png().toBuffer();
							embeddedImage = await pdfDoc.embedPng(convertedBuffer);
							console.log(`Successfully converted and embedded signature for field ${field.id}`);
						} catch (conversionError) {
							console.error(
								`Failed to convert/embed signature for field ${field.id}:`,
								conversionError.message
							);
							continue;
						}
					}
				}

				// Calculate image scaling to fit field while preserving aspect ratio
				const imgDims = embeddedImage.scale(1);
				const scaleX = dims.width / imgDims.width;
				const scaleY = dims.height / imgDims.height;
				const scale = Math.min(scaleX, scaleY); // Preserve aspect ratio

				const drawWidth = imgDims.width * scale;
				const drawHeight = imgDims.height * scale;

				// Center the image within the field if it's smaller than the field
				// due to aspect ratio preservation
				const xOffset = (dims.width - drawWidth) / 2;
				const yOffset = (dims.height - drawHeight) / 2;

				// PDF coordinate origin is bottom-left
				const x = dims.left + xOffset;
				const y = pageHeight - dims.top - drawHeight - yOffset;

				// Draw the signature on the page
				page.drawImage(embeddedImage, {
					x,
					y,
					width: drawWidth,
					height: drawHeight,
				});

				console.log(
					`Applied signature for field ${field.id} on page ${field.pageNumber} at (${x.toFixed(
						1
					)}, ${y.toFixed(1)}) size ${drawWidth.toFixed(1)}x${drawHeight.toFixed(
						1
					)} (centered with offsets x:${xOffset.toFixed(1)}, y:${yOffset.toFixed(1)})`
				);
			} catch (fieldError) {
				console.error(`Error processing field ${field.id}:`, fieldError);
				// Continue with other fields
			}
		}

		// Save the modified PDF
		const signedPdfBytes = await pdfDoc.save();
		const outputPath = getSignedPdfPath(template._id);

		// Ensure directory exists
		const outputDir = path.dirname(outputPath);
		if (!fs.existsSync(outputDir)) {
			fs.mkdirSync(outputDir, { recursive: true });
		}

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
		const { signatures, fields: incomingFields, viewport, recipients, message } = req.body;

		console.log(`[ApplySignatures] SENDER SIGNING - Request received:`, {
			templateId,
			userId: req.user?.id,
			userEmail: req.user?.email,
			signaturesCount: signatures?.length || 0,
			fieldsCount: incomingFields?.length || 0,
			signatures: signatures?.map(sig => ({
				fieldId: sig.fieldId,
				type: sig.type,
				hasImageData: !!sig.signatureImageBuffer,
				imageDataLength: sig.signatureImageBuffer?.length || 0
			}))
		});

		if (!TemplateValidator.isValidObjectId(templateId)) {
			return res.status(400).json({ success: false, message: "Invalid template ID" });
		}

		const template = await DocuSignTemplate.findById(templateId);
		if (!template) {
			return res.status(404).json({ success: false, message: "Template not found" });
		}

		// Enforce free-tier signing limit: if the current user is the owner and has no active subscription,
		// allow only one signed document total (status === 'final'). If already signed one, block further signing.
		try {
			const userId = req.user?.id;
			if (userId && String(template.createdBy) === String(userId)) {
				const now = new Date();
				const activeSub = await Subscription.findOne({
					userId,
					status: "active",
					$or: [{ endDate: { $exists: false } }, { endDate: { $gt: now } }],
				});

				if (!activeSub) {
					const signedCount = await DocuSignTemplate.countDocuments({
						createdBy: userId,
						status: "final",
						isArchived: { $ne: true },
					});

					const { signedLimit } = getFreeTierLimits();
					// If this template is already final we shouldn't block; otherwise enforce limit
					if (signedCount >= signedLimit && template.status !== "final") {
						return res.status(403).json({
							success: false,
							code: "FREE_SIGN_LIMIT_REACHED",
							message: "Free plan signing limit reached. Upgrade your plan to sign more documents.",
						});
					}
				}
			}
		} catch (limitErr) {
			console.error("Free-tier sign limit check failed:", limitErr);
			// Continue without blocking on limit check failure
		}

		// Process and save recipients if provided
		if (recipients && Array.isArray(recipients) && recipients.length > 0) {
			const User = (await import("../../models/User.js")).default;

			// Enrich recipients with user IDs where possible
			const enrichedRecipients = await Promise.all(
				recipients.map(async (recipient) => {
					const recipientData = {
						id: recipient.id || `${Date.now()}-${Math.random()}`,
						name: recipient.name,
						email: recipient.email,
						signatureStatus: "pending",
						notifiedAt: new Date(),
					};

					// Try to find matching user by email or ID
					if (recipient.email) {
						const user = await User.findOne({ email: recipient.email });
						if (user) {
							recipientData.userId = user._id;
						}
					} else if (recipient.id) {
						const user = await User.findById(recipient.id).catch(() => null);
						if (user) {
							recipientData.userId = user._id;
							recipientData.email = user.email;
						}
					}

					return recipientData;
				})
			);

			template.recipients = enrichedRecipients;
			console.log(`[Signature] Saved ${enrichedRecipients.length} recipients to template`);
		}

		// Save message if provided
		if (message) {
			template.message = {
				subject: message.subject || "",
				body: message.body || "",
			};
			console.log(`[Signature] Saved message: ${message.subject}`);
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

		// Update the existing DocuSignDocument with final signed PDF info (instead of creating a new one)
		try {
			const finalBuf = fs.readFileSync(outPath);
			const finalHash = crypto.createHash("sha256").update(finalBuf).digest("hex");

			// Find the existing document linked to this template
			let finalDoc = null;
			if (template.metadata?.document) {
				finalDoc = await DocuSignDocument.findById(template.metadata.document);
			}

			if (finalDoc) {
				// Update the existing document with final PDF information
				finalDoc.finalPdfPath = template.finalPdfUrl;
				finalDoc.finalPdfHash = finalHash;
				finalDoc.finalPdfSize = finalBuf.length;
				finalDoc.status = "signed";
				await finalDoc.save();

				console.log(`[Signature] Updated existing DocuSignDocument ${finalDoc._id} with final PDF`);
			} else {
				// Fallback: create a new document if none exists (shouldn't happen in normal flow)
				console.warn("[Signature] No existing DocuSignDocument found, creating new one");
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

				// Update template reference
				template.metadata = template.metadata || {};
				template.metadata.document = finalDoc._id;
				await template.save();
			}
		} catch (err) {
			console.warn("Failed to update DocuSignDocument with final PDF:", err.message);
		}

		await logDocuSignActivity(
			req.user?.id,
			"DOCUSIGN_TEMPLATE_SIGNED",
			`Signatures applied to DocuSign template: ${template.name}`,
			{ templateId: template._id, name: template.name, signatureCount: signatures?.length || 0 },
			req
		);

		// Send notifications to recipients if they exist
		if (template.recipients && template.recipients.length > 0) {
			try {
				const User = (await import("../../models/User.js")).default;
				const { notifyAllRecipients } = await import("../../services/NotificationService.js");

				// Get sender name
				const sender = await User.findById(req.user?.id);
				const senderName = sender
					? `${sender.firstName || ""} ${sender.lastName || ""}`.trim() || sender.email
					: "Someone";

				// Get app base URL from environment or request
				const appBaseUrl =
					process.env.FRONTEND_URL ||
					process.env.NEXT_PUBLIC_APP_URL ||
					`${req.protocol}://${req.get("host")}`;

				// Send notifications
				const notificationResult = await notifyAllRecipients({
					template,
					senderName,
					appBaseUrl,
				});

				console.log(
					`[Signature] Sent ${notificationResult.notified} notification(s) to recipients`
				);
			} catch (notifyError) {
				// Don't fail the request if notifications fail
				console.error("[Signature] Failed to send notifications:", notifyError.message);
			}
		}

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
