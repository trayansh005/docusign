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
import multer from "multer";
import { getFreeTierLimits } from "../../utils/freeTierLimits.js";

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

// Optimized multer configuration
const storage = multer.diskStorage({
	destination: (req, file, cb) => {
		ensureDirs();
		cb(null, PDFS_DIR);
	},
	filename: (req, file, cb) => {
		const uniqueId = uuidv4();
		const ext = path.extname(file.originalname);
		cb(null, `${uniqueId}${ext}`);
	},
});

export const upload = multer({
	storage,
	fileFilter: (req, file, cb) => {
		const allowedMimeTypes = [
			"application/pdf",
			"application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
			"application/msword", // .doc
		];
		if (allowedMimeTypes.includes(file.mimetype)) {
			cb(null, true);
		} else {
			cb(new Error("Only PDF, DOCX, and DOC files are allowed"), false);
		}
	},
	limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
});

/**
 * Create initial template record
 */
async function createInitialTemplate(file, name, type, userId) {
	const template = await DocuSignTemplate.create({
		name: name || `Document ${path.parse(file.originalname).name}`,
		type: type || "document",
		status: "draft",
		createdBy: userId,
		metadata: {
			filename: file.originalname,
			mimeType: file.mimetype,
			fileSize: file.size,
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
export const uploadAndProcessDocument = async (req, res) => {
	// Enforce free-tier limit: users without an active subscription can only upload 1 document
	try {
		const userId = req.user?.id;
		console.log("[Upload] User ID:", userId);
		if (!userId) {
			return res.status(401).json({ success: false, message: "Authentication required" });
		}

		// Check if user has an active subscription
		const now = new Date();
		const activeSub = await Subscription.findOne({
			userId,
			status: "active",
			$or: [{ endDate: { $exists: false } }, { endDate: { $gt: now } }],
		});

		console.log("[Upload] Active subscription found:", !!activeSub);

		if (!activeSub) {
			// Count existing non-archived templates created by this user
			const existingCount = await DocuSignTemplate.countDocuments({
				createdBy: userId,
				isArchived: { $ne: true },
			});

			const { uploadLimit } = getFreeTierLimits();
			console.log("[Upload] Free tier - Existing count:", existingCount, "Limit:", uploadLimit);
			
			if (existingCount >= uploadLimit) {
				console.log("[Upload] FREE LIMIT REACHED - returning 403");
				return res.status(403).json({
					success: false,
					code: "FREE_LIMIT_REACHED",
					message: "Free plan limit reached. Upgrade to upload more documents.",
				});
			}
		}
	} catch (limitErr) {
		console.error("Free-tier upload limit check failed:", limitErr);
		// Proceed without blocking on limit check failure
	}

	if (!req.file) {
		return res.status(400).json({
			success: false,
			message: "No document file uploaded",
		});
	}

	const { name, type = "document" } = req.body;
	const userId = req.user?.id;
	let template;

	try {
		// Validate document file first
		if (!req.file.path || !fs.existsSync(req.file.path)) {
			throw new Error("Document file not found or invalid");
		}

		// Create initial template record
		template = await createInitialTemplate(req.file, name, type, userId);
		template.status = "processing";
		await template.save();

		const templateId = template._id.toString();
		const templateDir = path.join(TEMPLATES_DIR, templateId);
		if (!fs.existsSync(templateDir)) fs.mkdirSync(templateDir, { recursive: true });

		// Move uploaded file to template directory
		const safeOriginalName = path.basename(req.file.originalname).replace(/[^a-zA-Z0-9._-]/g, "_");
		const storedFileName = `${templateId}_${safeOriginalName}`;
		const newFilePath = path.join(templateDir, storedFileName);
		fs.renameSync(req.file.path, newFilePath);

		let pdfFilePath = newFilePath;
		let numPages = 0;

		// Process based on file type
		if (isWordDocument(req.file.mimetype)) {
			console.log(`[Upload] Processing Word document: ${req.file.originalname}`);

			// Convert Word to PDF first
			const conversionResult = await processWordDocument(newFilePath, templateDir, templateId);

			if (conversionResult.success) {
				// Use the converted PDF
				pdfFilePath = conversionResult.pdfPath;
				console.log(`[Upload] Word converted to PDF: ${pdfFilePath}`);
				numPages = await getPdfPageCount(pdfFilePath);
			} else {
				// Conversion failed - return error
				throw new Error(`Word to PDF conversion failed: ${conversionResult.error}`);
			}
		} else if (req.file.mimetype === "application/pdf") {
			console.log(`[Upload] Processing PDF document: ${req.file.originalname}`);
			numPages = await getPdfPageCount(pdfFilePath);
		} else {
			throw new Error("Unsupported file type");
		}

		if (numPages === 0) {
			throw new Error("PDF has no pages or could not be read");
		}

		// Update template with processed data
		template.name = name || path.parse(req.file.originalname).name;
		template.numPages = numPages;
		template.status = "draft";

		// Set pdfUrl to the PDF file (either original or converted from Word)
		// Normalize the path to handle Windows backslashes
		const normalizedPdfPath = pdfFilePath.replace(/\\/g, "/");
		const pdfFileName = normalizedPdfPath.split("/").pop();
		const pdfUrl = `/api/uploads/signatures/templates/${templateId}/${pdfFileName}`;

		console.log(`[Upload] PDF file path: ${pdfFilePath}`);
		console.log(`[Upload] Normalized path: ${normalizedPdfPath}`);
		console.log(`[Upload] PDF file name: ${pdfFileName}`);
		console.log(`[Upload] Constructed pdfUrl: ${pdfUrl}`);
		console.log(`[Upload] PDF file exists: ${fs.existsSync(pdfFilePath)}`);

		// Store original Word document info if it was a Word file
		if (isWordDocument(req.file.mimetype)) {
			template.metadata.originalWordFile = storedFileName;
			template.metadata.convertedFromWord = true;
		}

		// Update metadata with PDF path (pdfUrl is a virtual field that reads from metadata.originalPdfPath)
		template.metadata = {
			...template.metadata,
			fileId: templateId,
			mimeType: req.file.mimetype,
			fileSize: req.file.size,
			originalPdfPath: pdfUrl, // This is what pdfUrl virtual field reads from
			originalFilePath: `/api/uploads/signatures/templates/${templateId}/${storedFileName}`,
		};

		console.log(`[Upload] Set metadata.originalPdfPath: ${template.metadata.originalPdfPath}`);
		template.markModified("metadata");
		await template.save();

		console.log(`[Upload] Template saved with pdfUrl: ${template.pdfUrl}`);

		// Create a DocuSignDocument record for the uploaded file
		try {
			const fileBuffer = fs.readFileSync(newFilePath);
			const fileHash = crypto.createHash("sha256").update(fileBuffer).digest("hex");
			const doc = await DocuSignDocument.create({
				fileId: path.parse(req.file.filename).name,
				filename: req.file.originalname,
				mimeType: req.file.mimetype,
				fileSize: req.file.size,
				originalPdfPath: `/uploads/signatures/templates/${templateId}/${storedFileName}`,
				fileHash,
				status: "ready",
				template: template._id, // Link back to the template
			});

			// Link the document to the template
			template.metadata.document = doc._id;
			template.metadata.fileHash = fileHash;
			template.markModified("metadata");
			await template.save();

			console.log(
				`[Upload] Created DocuSignDocument ${doc._id} linked to template ${template._id}`
			);
		} catch (err) {
			console.warn("Failed to create DocuSignDocument for uploaded file:", err.message);
		}

		// Log activity
		await logDocuSignActivity(
			userId,
			"DOCUSIGN_TEMPLATE_CREATED",
			`Created DocuSign template: ${template.name}`,
			{ templateId: template._id, name: template.name, type: template.type },
			req
		);

		return res.status(201).json({
			success: true,
			data: template.toObject(),
			message: "Document processed successfully",
		});
	} catch (error) {
		console.error("uploadAndProcessDocument error:", error);

		if (template) {
			await markTemplateAsFailed(template, error.message);
		}

		// Clean up uploaded file if processing failed
		if (req.file?.path && fs.existsSync(req.file.path)) {
			try {
				fs.unlinkSync(req.file.path);
			} catch (cleanupErr) {
				console.error("Failed to cleanup uploaded file:", cleanupErr);
			}
		}

		return res.status(500).json({
			success: false,
			message: error.message || "Failed to process document",
		});
	}
};
