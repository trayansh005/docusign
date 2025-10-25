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
					// A) Percentage-based - check if values are already decimals (0-1) or percentages (0-100)
					const xPct = Number(sig.xPct) > 1 ? Number(sig.xPct) / 100 : Number(sig.xPct);
					const yPct = Number(sig.yPct) > 1 ? Number(sig.yPct) / 100 : Number(sig.yPct);
					const wPct = Number(sig.wPct) > 1 ? Number(sig.wPct) / 100 : Number(sig.wPct);
					const hPct = Number(sig.hPct) > 1 ? Number(sig.hPct) / 100 : Number(sig.hPct);

					targetLeft = xPct * pageWidth;
					targetTop = yPct * pageHeight;
					targetWidth = wPct * pageWidth;
					targetHeight = hPct * pageHeight;
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

				// Check if this is a text field (address, email, phone, name, text, date)
				const isTextField = ['address', 'email', 'phone', 'name', 'text', 'date'].includes(sig.type);

				if (isTextField) {
					// Handle text fields - draw text directly on PDF
					const textValue = sig.signatureImageBuffer || '';
					if (!textValue || textValue.trim() === '') {
						console.warn(`[ApplySignatures] No text value for field ${sig.fieldId}`);
						continue;
					}

					console.log(`[ApplySignatures] Processing text field ${sig.fieldId} as plain text: "${textValue}"`);
					console.log(`[ApplySignatures] Page dimensions: ${pageWidth} x ${pageHeight}`);
					console.log(`[ApplySignatures] Target coordinates: left=${targetLeft}, top=${targetTop}, width=${targetWidth}, height=${targetHeight}`);

					// Convert from top-based coordinates to PDF bottom-left origin
					// PDF coordinate system: (0,0) is bottom-left, Y increases upward
					const x = targetLeft;
					const y = pageHeight - targetTop - targetHeight; // Convert from top-based to bottom-based

					console.log(`[ApplySignatures] Converted coordinates: x=${x}, y=${y}`);

					// Calculate appropriate font size based on field dimensions
					// Ensure minimum readable font size
					const fontSize = Math.max(Math.min(targetHeight * 0.6, 16), 8); // Scale font to field height, min 8pt, max 16pt

					// Calculate final text position (center vertically in the field)
					const textX = x + 5; // Small padding from left edge
					const textY = y + (targetHeight / 2); // Center vertically in field

					console.log(`[ApplySignatures] Final text position: (${textX}, ${textY}) with fontSize=${fontSize}`);

					try {
						page.drawText(textValue, {
							x: textX,
							y: textY,
							size: fontSize,
							color: { type: 'RGB', red: 0, green: 0, blue: 0 },
						});
						console.log(`[ApplySignatures] Successfully drew text "${textValue}" at position (${textX}, ${textY})`);
					} catch (textError) {
						console.error(`[ApplySignatures] Error drawing text for field ${sig.fieldId}:`, textError);
					}

					continue; // Skip image processing for text fields
				}

				// Extract base64 image data for signature/initial fields
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
 * Unified document signing endpoint for both recipients and senders
 * Handles both recipient signing and sender (owner) signing with the same logic
 * Uses direct signature processing with percentage-based coordinates
 * POST /api/docusign/:templateId/sign
 */
export const recipientSignDocument = async (req, res) => {
	try {
		const { templateId } = req.params;
		const { signatures, placeholderFields, recipients, message } = req.body;
		const userId = req.user?.id || req.user?._id;
		const userEmail = req.user?.email;



		// Validate input - allow empty signatures if there are placeholder fields
		const hasSignatures = signatures && Array.isArray(signatures) && signatures.length > 0;
		const hasPlaceholders = placeholderFields && Array.isArray(placeholderFields) && placeholderFields.length > 0;

		if (!hasSignatures && !hasPlaceholders) {
			return res.status(400).json({
				success: false,
				error: "Either signatures or placeholder fields are required",
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

		// Check if user is a recipient or template owner (unified signing)
		const myRecipient = template.recipients?.find(
			(r) => r.email === userEmail || r.userId?.toString() === userId?.toString()
		);

		let isTemplateOwner = false;
		if (!myRecipient) {
			// Check if user is the template owner (sender signing)
			const templateOwnerId = template.userId?.toString() || template.createdBy?.toString();
			isTemplateOwner = templateOwnerId === userId?.toString();

			if (!isTemplateOwner) {
				return res.status(403).json({
					success: false,
					error: "You are not authorized to sign this document",
				});
			}
			// Template owner can sign without being in recipients list
		} else {
			// Check signing order for recipients (not template owners)
			if (template.recipients && template.recipients.length > 1) {
				const canSign = template.canRecipientSign(userEmail);
				if (!canSign) {
					const nextRecipient = template.getNextRecipientToSign();
					return res.status(403).json({
						success: false,
						error: "It's not your turn to sign yet",
						message: nextRecipient
							? `Please wait for ${nextRecipient.name} to sign first`
							: "Please wait for the previous signer to complete",
						nextRecipient: nextRecipient ? {
							name: nextRecipient.name,
							email: nextRecipient.email,
							signingOrder: nextRecipient.signingOrder,
						} : null,
					});
				}
			}
		}

		// Check if already signed (for existing recipients)
		if (myRecipient && myRecipient.signatureStatus === "signed") {
			return res.status(400).json({
				success: false,
				error: "You have already signed this document",
			});
		}

		// Enforce free-tier signing limit for template owners
		if (isTemplateOwner) {
			try {
				const Subscription = (await import("../../models/Subscription.js")).default;
				const { getFreeTierLimits } = await import("../../utils/freeTierLimits.js");

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
					if (signedCount >= signedLimit && template.status !== "final") {
						return res.status(403).json({
							success: false,
							code: "FREE_SIGN_LIMIT_REACHED",
							message: "Free plan signing limit reached. Upgrade your plan to sign more documents.",
						});
					}
				}
			} catch (limitErr) {
				console.error("Free-tier limit check failed:", limitErr);
				// Continue without blocking on limit check failure
			}
		}

		// Add placeholder fields to template if provided (for sender signing with recipients)
		if (placeholderFields && Array.isArray(placeholderFields) && placeholderFields.length > 0) {
			// Valid field types according to schema
			const validTypes = ["signature", "date", "initial", "text", "name", "email", "phone", "address"];

			// Convert placeholder fields to template signature fields
			const newSignatureFields = placeholderFields.map(field => ({
				id: field.id,
				recipientId: "placeholder", // Will be assigned to actual recipients later
				type: validTypes.includes(field.type) ? field.type : "signature", // Fallback to signature if invalid
				pageNumber: field.pageNumber,
				// Convert percentage values from 0-100 to 0-1 for database
				xPct: (field.xPct || 0) / 100,
				yPct: (field.yPct || 0) / 100,
				wPct: (field.wPct || 20) / 100,
				hPct: (field.hPct || 5) / 100,
				required: field.required || false,
				placeholder: true,
				placeholderText: field.placeholderText,
			}));

			// Add new placeholder fields to existing signature fields
			template.signatureFields = [...(template.signatureFields || []), ...newSignatureFields];
		}

		// Ensure all signature fields have valid percentage values (0-1 range)
		if (template.signatureFields && template.signatureFields.length > 0) {
			template.signatureFields = template.signatureFields.map(field => {
				const convertedField = { ...field };

				// Convert any percentage values > 1 to proper 0-1 range
				if (convertedField.xPct && convertedField.xPct > 1) {
					convertedField.xPct = convertedField.xPct / 100;
				}
				if (convertedField.yPct && convertedField.yPct > 1) {
					convertedField.yPct = convertedField.yPct / 100;
				}
				if (convertedField.wPct && convertedField.wPct > 1) {
					convertedField.wPct = convertedField.wPct / 100;
				}
				if (convertedField.hPct && convertedField.hPct > 1) {
					convertedField.hPct = convertedField.hPct / 100;
				}

				return convertedField;
			});
		}

		// Update recipients if provided
		if (recipients && Array.isArray(recipients) && recipients.length > 0) {
			const User = (await import("../../models/User.js")).default;

			// Enrich recipients with user IDs where possible
			const enrichedRecipients = await Promise.all(
				recipients.map(async (recipient, index) => {
					const recipientData = {
						id: recipient.id || `${Date.now()}-${Math.random()}`,
						name: recipient.name,
						email: recipient.email,
						signatureStatus: index === 0 ? "pending" : "waiting", // First recipient is pending, others wait
						signingOrder: recipient.signingOrder || (index + 1), // Use provided order or auto-assign
						notifiedAt: new Date(),
						eligibleAt: index === 0 ? new Date() : null, // Only first recipient is eligible initially
					};

					// Try to find matching user by email
					if (recipient.email) {
						const user = await User.findOne({ email: recipient.email });
						if (user) {
							recipientData.userId = user._id;
						}
					}

					return recipientData;
				})
			);

			template.recipients = enrichedRecipients;
		}

		// Save message if provided
		if (message) {
			template.message = {
				subject: message.subject || "",
				body: message.body || "",
			};
		}

		// Apply signatures to PDF (direct percentage-based coordinates)
		let signedPdfPath;
		if (hasSignatures) {
			signedPdfPath = await applySignaturesToPdf(template, signatures);
		} else {
			// No signatures to apply, just use original PDF
			signedPdfPath = resolveTemplatePdfPath(template);
		}

		// Update template with signed PDF URL (only if signatures were applied)
		if (hasSignatures) {
			const pdfUrl = signedPdfPath.replace(path.join(__dirname, "..", ".."), "").replace(/\\/g, "/");
			template.finalPdfUrl = pdfUrl.startsWith("/") ? pdfUrl : `/${pdfUrl}`;
		}

		// Update recipient status and signing order (only for actual recipients, not template owners)
		if (!isTemplateOwner) {
			const recipientIndex = template.recipients.findIndex(
				(r) => r.email === userEmail || r.userId?.toString() === userId?.toString()
			);

			if (recipientIndex !== -1) {
				// Mark this recipient as signed
				await template.markRecipientSigned(userEmail);
			}
		}

		// Check if all recipients have signed
		const allRecipientsSigned = template.recipients.every((r) => r.signatureStatus === "signed");
		if (allRecipientsSigned) {
			template.status = "final";
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
			console.error("Failed to update DocuSignDocument:", docError);
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
				recipientStatus: isTemplateOwner ? null : (template.recipients.find(r => r.email === userEmail || r.userId?.toString() === userId?.toString()) || null),
				allSigned: allRecipientsSigned,
				signerType: isTemplateOwner ? 'owner' : 'recipient'
			},
		});
	} catch (error) {
		console.error("Unified sign error:", error);
		res.status(500).json({
			success: false,
			error: "Failed to save signatures",
			details: error.message,
		});
	}
};
