import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { v4 as uuidv4 } from "uuid";
import crypto from "crypto";
import DocuSignTemplate from "../../models/DocuSignTemplate.js";
import DocuSignDocument from "../../models/DocuSignDocument.js";
import { logDocuSignActivity } from "../../services/ActivityService.js";
import multer from "multer";

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
			"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
			"application/msword",
		];
		if (allowedMimeTypes.includes(file.mimetype)) {
			cb(null, true);
		} else {
			cb(new Error("Only PDF and DOCX files are allowed"), false);
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
 * Upload and process PDF or DOCX document
 */
export const uploadAndProcessPDF = async (req, res) => {
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

		// Move uploaded file into the canonical templates folder
		const uploadedFilename = path.basename(req.file.path);
		const destPath = path.join(TEMPLATES_DIR, uploadedFilename);
		try {
			fs.renameSync(req.file.path, destPath);
		} catch (moveErr) {
			// If rename fails, fallback to leaving the file in place
			console.warn(
				"Failed to move uploaded file to templates dir, leaving in pdfs:",
				moveErr.message
			);
		}

		const relativeFilePath = destPath
			.replace(path.join(__dirname, "..", ".."), "")
			.replace(/\\/g, "/");

		template.status = "draft";
		template.metadata.originalPdfPath = relativeFilePath;
		template.metadata.mimeType = req.file.mimetype;
		template.numPages = 1; // Set to 1 to pass validation, frontend controls actual pages

		// Create a DocuSignDocument record for the uploaded file
		try {
			const fileBuffer = fs.readFileSync(destPath);
			const fileHash = crypto.createHash("sha256").update(fileBuffer).digest("hex");
			const doc = await DocuSignDocument.create({
				fileId: path.parse(req.file.filename).name,
				filename: req.file.originalname,
				mimeType: req.file.mimetype,
				fileSize: req.file.size,
				originalPdfPath: relativeFilePath,
				fileHash,
				status: "ready",
			});

			// Link the document to the template
			template.metadata.document = doc._id;
			template.metadata.fileHash = fileHash;
		} catch (err) {
			console.warn("Failed to create DocuSignDocument for uploaded file:", err.message);
		}

		await template.save();

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
		console.error("uploadAndProcessPDF error:", error);

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
