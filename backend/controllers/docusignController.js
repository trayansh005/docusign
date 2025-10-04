import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { v4 as uuidv4 } from "uuid";
import crypto from "crypto";
import { fromPath as pdf2picFromPath } from "pdf2pic";
import sharp from "sharp";
import DocuSignTemplate from "../models/DocuSignTemplate.js";
import Activity from "../models/Activity.js";
import ipLocationService from "../services/ipLocationService.js";
import multer from "multer";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE_DIR = path.join(__dirname, "../uploads/signatures");
const TEMPLATES_DIR = path.join(BASE_DIR, "templates");
const PDFS_DIR = path.join(BASE_DIR, "pdfs");

// Debug logging for path resolution
console.log(`[DEBUG] DocuSign Controller - BASE_DIR: ${BASE_DIR}`);
console.log(`[DEBUG] DocuSign Controller - TEMPLATES_DIR: ${TEMPLATES_DIR}`);

// Helper function to log DocuSign activities with IP tracking
const logDocuSignActivity = async (userId, type, message, details = {}, req = null) => {
	try {
		const activityData = {
			user: userId,
			type,
			message,
			details,
		};

		// Add IP and location if request object is provided
		if (req) {
			activityData.details = {
				...details,
				ipAddress: ipLocationService.extractIPAddress(req),
				userAgent: req.headers["user-agent"],
				timestamp: new Date(),
			};
		}

		await Activity.create(activityData);
	} catch (error) {
		console.error("Error logging DocuSign activity:", error);
	}
};

// Async version of directory creation
async function ensureDirs() {
	const { mkdir, access } = fs.promises;

	for (const dir of [BASE_DIR, TEMPLATES_DIR, PDFS_DIR]) {
		try {
			await access(dir);
		} catch {
			await mkdir(dir, { recursive: true });
		}
	}
}

const storage = multer.diskStorage({
	destination: async (req, file, cb) => {
		try {
			await ensureDirs();
			cb(null, PDFS_DIR);
		} catch (error) {
			cb(error, null);
		}
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
		if (file.mimetype === "application/pdf") cb(null, true);
		else cb(new Error("Only PDF files are allowed"), false);
	},
	limits: { fileSize: 50 * 1024 * 1024 },
});



export const uploadAndProcessPDF = async (req, res) => {
	if (!req.file) return res.status(400).json({ success: false, message: "No PDF file uploaded" });

	const { name, type = "document" } = req.body;
	const userId = req.user?.id;
	let template;

	try {
		const initialTemplateData = {
			name: name || `Processing ${path.parse(req.file.originalname).name}`,
			type,
			status: "processing",
			createdBy: userId,
			metadata: { filename: req.file.originalname },
		};

		template = new DocuSignTemplate(initialTemplateData);
		await template.save();

		const templateId = template._id.toString();
		const templateDir = path.join(TEMPLATES_DIR, templateId);
		if (!fs.existsSync(templateDir)) fs.mkdirSync(templateDir, { recursive: true });

		const safeOriginalName = path.basename(req.file.originalname).replace(/[^a-zA-Z0-9._-]/g, "_");
		const storedPdfName = `${templateId}_${safeOriginalName}`;
		const newPdfPath = path.join(templateDir, storedPdfName);

		fs.renameSync(req.file.path, newPdfPath);

		// Enhanced GraphicsMagick and Ghostscript detection for Windows
		let gmDirectory = null;
		try {
			if (process.platform === "win32") {
				const programFiles = process.env["ProgramFiles"] || "C:\\Program Files";
				const gmRootCandidates = fs
					.readdirSync(programFiles, { withFileTypes: true })
					.filter((d) => d.isDirectory() && d.name.toLowerCase().startsWith("graphicsmagick"))
					.map((d) => path.join(programFiles, d.name));

				for (const gmRoot of gmRootCandidates) {
					const candidate = path.join(gmRoot, "gm.exe");
					if (fs.existsSync(candidate)) {
						gmDirectory = gmRoot;
						process.env.PATH = `${gmRoot};${process.env.PATH}`;
						break;
					}
				}

				const gsRoot = path.join(programFiles, "gs");
				if (fs.existsSync(gsRoot)) {
					const versions = fs
						.readdirSync(gsRoot, { withFileTypes: true })
						.filter((d) => d.isDirectory())
						.map((d) => path.join(gsRoot, d.name, "bin"))
						.filter((p) => fs.existsSync(p));

					if (versions.length > 0) process.env.PATH = `${versions[0]};${process.env.PATH}`;
				}
			}
		} catch { }

		const converter = pdf2picFromPath(newPdfPath, {
			density: 300,
			saveFilename: "page",
			savePath: templateDir,
			format: "png",
			width: 2480,
			height: 3508,
			preserveAspectRatio: true,
			quality: 100,
		});

		if (gmDirectory) console.log(`GraphicsMagick directory added to PATH: ${gmDirectory}`);
		let results = [];
		try {
			results = await converter.bulk(-1, { responseType: "image" });
		} catch (e) {
			console.error("pdf2pic bulk error", e);
		}

		let numPages = Array.isArray(results) ? results.length : 0;
		if (numPages === 0) {
			const filesInDir = fs.readdirSync(templateDir);
			numPages = filesInDir.filter((f) => /^page.*\.png$/.test(f)).length;
		}

		if (numPages === 0)
			throw new Error("No pages were converted from the PDF. Ensure GraphicsMagick and Ghostscript are installed.");

		const pages = [];
		for (let i = 0; i < numPages; i++) {
			const pageNumber = i + 1;
			try {
				const candidates = [
					`page_${pageNumber}.png`,
					`page.${pageNumber}.png`,
					`page-${pageNumber}.png`,
					`page${pageNumber}.png`,
					`page-${String(pageNumber).padStart(3, '0')}.png`, // pdf-poppler format
					`page-${String(pageNumber).padStart(2, '0')}.png`, // pdf-poppler format
				];
				let imagePath = null;
				for (const n of candidates) {
					const p = path.join(templateDir, n);
					if (fs.existsSync(p)) {
						imagePath = p;
						break;
					}
				}
				if (!imagePath) continue;
				const standardPath = path.join(templateDir, `page_${pageNumber}.png`);
				if (imagePath !== standardPath) fs.renameSync(imagePath, standardPath);
				const tempPath = path.join(templateDir, `temp_page_${pageNumber}.png`);
				await sharp(standardPath)
					.png({ quality: 95, compressionLevel: 6, palette: false })
					.resize(1920, null, { withoutEnlargement: true, kernel: sharp.kernel.lanczos3 })
					.toFile(tempPath);
				fs.unlinkSync(standardPath);
				fs.renameSync(tempPath, standardPath);
				const imageBuffer = fs.readFileSync(standardPath);
				const imageHash = crypto.createHash("sha256").update(imageBuffer).digest("hex");
				const imageUrl = `/uploads/signatures/templates/${templateId}/page_${pageNumber}.png`;
				let meta;
				try {
					meta = await sharp(standardPath).metadata();
				} catch {
					meta = {};
				}
				pages.push({
					pageNumber,
					imageUrl,
					imageHash,
					fileSize: imageBuffer.length,
					width: meta?.width || undefined,
					height: meta?.height || undefined,
				});
			} catch (pageErr) {
				console.error(`Process page ${pageNumber} failed`, pageErr);
			}
		}
		if (pages.length === 0) throw new Error("No pages were successfully processed.");

		template.name = name || path.parse(req.file.originalname).name;
		template.imageUrl = pages[0]?.imageUrl || "";
		template.numPages = pages.length;
		template.status = "draft";
		template.metadata = {
			...template.metadata,
			fileId: templateId,
			imageHash: pages[0]?.imageHash || "",
			mimeType: "image/png",
			fileSize: pages.reduce((t, p) => t + p.fileSize, 0),
			pages,
			originalPdfPath: `/uploads/signatures/templates/${templateId}/${storedPdfName}`,
		};
		template.markModified("metadata");
		await template.save();

		// Log activity
		await logDocuSignActivity(
			userId,
			"DOCUSIGN_TEMPLATE_CREATED",
			`Created DocuSign template: ${template.name}`,
			{ templateId: template._id, name: template.name, type: template.type }
		);

		return res.status(201).json({
			success: true,
			data: { ...template.toObject(), pages },
			message: "PDF processed successfully",
		});
	} catch (error) {
		console.error("uploadAndProcessPDF error:", error);
		if (template) {
			template.status = "failed";
			template.metadata.error = error.message;
			template.markModified("metadata");
			await template.save();
		}
		return res
			.status(500)
			.json({ success: false, message: error.message || "Failed to process PDF" });
	}
};

// Get template page metadata
export const getTemplatePage = async (req, res) => {
	try {
		const { templateId, pageNumber } = req.params;
		const template = await DocuSignTemplate.findOne({
			$or: [{ _id: templateId }, { "metadata.fileId": templateId }],
			isArchived: false,
		});
		if (!template) return res.status(404).json({ success: false, message: "Template not found" });
		const page = parseInt(pageNumber);
		if (page < 1 || page > template.numPages)
			return res.status(400).json({ success: false, message: "Invalid page number" });
		const pageData = template.metadata.pages?.find((p) => p.pageNumber === page);
		if (!pageData) return res.status(404).json({ success: false, message: "Page not found" });
		return res.status(200).json({
			success: true,
			data: {
				templateId: template._id,
				pageNumber: page,
				imageUrl: `http://localhost:5000${pageData.imageUrl}`,
				imageHash: pageData.imageHash,
				fileSize: pageData.fileSize,
				width: pageData.width,
				height: pageData.height,
			},
		});
	} catch (error) {
		return res
			.status(500)
			.json({ success: false, message: error.message || "Failed to get template page" });
	}
};

// Get template page image file
export const getTemplatePageImage = async (req, res) => {
	try {
		const { templateId, pageNumber } = req.params;
		if (!templateId || !pageNumber)
			return res
				.status(400)
				.json({ success: false, message: "Missing template ID or page number" });
		const page = parseInt(pageNumber, 10);
		if (isNaN(page) || page < 1)
			return res.status(400).json({ success: false, message: "Invalid page number" });
		const template = await DocuSignTemplate.findById(templateId);
		if (!template) return res.status(404).json({ success: false, message: "Template not found" });
		if (page > template.numPages)
			return res.status(404).json({ success: false, message: "Page not found in this template" });
		const imagePath = path.join(TEMPLATES_DIR, templateId, `page_${page}.png`);
		if (fs.existsSync(imagePath)) return res.sendFile(imagePath);
		return res.status(404).json({ success: false, message: "Image file not found." });
	} catch (error) {
		return res
			.status(500)
			.json({ success: false, message: error.message || "Failed to get template page image" });
	}
};

// Update signature fields for a page
export const updateTemplatePageFields = async (req, res) => {
	try {
		const { templateId, pageNumber } = req.params;
		const { signatureFields } = req.body;
		const viewport = (req.body && (req.body.viewport || req.body.pageViewport)) || {};

		const template = await DocuSignTemplate.findOne({
			$or: [{ _id: templateId }, { "metadata.fileId": templateId }],
			isArchived: false,
		});
		if (!template) return res.status(404).json({ success: false, message: "Template not found" });
		const page = parseInt(pageNumber);
		if (page < 1 || page > template.numPages)
			return res.status(400).json({ success: false, message: "Invalid page number" });

		// Backward compatibility: if incoming fields omit pageNumber, assign from URL param
		const mapped = Array.isArray(signatureFields)
			? signatureFields.map((f) => {
				const pn = Number(f?.pageNumber ?? page);
				const vp = viewport?.[pn] || viewport?.[String(pn)] || {};

				// Smart viewport detection: if no viewport provided, assume common UI canvas sizes
				let baseW = f.viewportWidth || f.uiWidth || vp?.width;
				let baseH = f.viewportHeight || f.uiHeight || vp?.height;

				if (!baseW || !baseH) {
					const pageData = template.metadata?.pages?.find((p) => p.pageNumber === pn);
					const pageAspectRatio =
						pageData?.width && pageData?.height ? pageData.width / pageData.height : 1.33;

					if (pageAspectRatio > 1.5) {
						baseW = 1000;
						baseH = Math.round(1000 / pageAspectRatio);
					} else {
						baseW = 800;
						baseH = Math.round(800 / pageAspectRatio);
					}
				}

				const xPct = f.xPct != null ? f.xPct : baseW && f.x != null ? f.x / baseW : undefined;
				const yPct = f.yPct != null ? f.yPct : baseH && f.y != null ? f.y / baseH : undefined;
				const wPct =
					f.wPct != null ? f.wPct : baseW && f.width != null ? f.width / baseW : undefined;
				const hPct =
					f.hPct != null ? f.hPct : baseH && f.height != null ? f.height / baseH : undefined;
				return { ...f, pageNumber: pn, xPct, yPct, wPct, hPct };
			})
			: [];
		const pageFields = mapped.filter((f) => Number(f.pageNumber) === page);

		template.signatureFields = template.signatureFields
			.filter((f) => f.pageNumber !== page)
			.concat(pageFields);
		template.updatedBy = req.user?.id;

		// Skip audit trail for frequent signature field updates
		template.skipAuditTrail = true;
		await template.save();

		// Log activity
		await logDocuSignActivity(
			req.user?.id,
			"DOCUSIGN_TEMPLATE_UPDATED",
			`Updated signature fields for DocuSign template: ${template.name}`,
			{ templateId: template._id, name: template.name, pageNumber: page }
		);

		return res.status(200).json({
			success: true,
			data: template,
			message: "Template page fields updated successfully",
		});
	} catch (error) {
		return res
			.status(500)
			.json({ success: false, message: error.message || "Failed to update template page fields" });
	}
};

// Delete template
export const deleteTemplate = async (req, res) => {
	try {
		const { templateId } = req.params;
		const template = await DocuSignTemplate.findOne({
			$or: [{ _id: templateId }, { "metadata.fileId": templateId }],
			isArchived: false,
		});
		if (!template) return res.status(404).json({ success: false, message: "Template not found" });
		template.isArchived = true;
		template.updatedBy = req.user?.id;
		await template.save();

		// Log activity
		await logDocuSignActivity(
			req.user?.id,
			"DOCUSIGN_TEMPLATE_DELETED",
			`Deleted DocuSign template: ${template.name}`,
			{ templateId: template._id, name: template.name }
		);

		return res.status(200).json({ success: true, message: "Template archived successfully" });
	} catch (error) {
		return res
			.status(500)
			.json({ success: false, message: error.message || "Failed to delete template" });
	}
};

// List templates with pagination
export const listTemplates = async (req, res) => {
	try {
		const { page = 1, limit = 10, status, type, search } = req.query;
		const query = { isArchived: false };
		if (status) query.status = status;
		if (type) query.type = type;
		if (search)
			query.$or = [
				{ name: { $regex: search, $options: "i" } },
				{ "metadata.filename": { $regex: search, $options: "i" } },
			];
		const skip = (parseInt(page) - 1) * parseInt(limit);
		const templates = await DocuSignTemplate.find(query)
			.sort({ createdAt: -1 })
			.skip(skip)
			.limit(parseInt(limit))
			.populate("createdBy", "firstName lastName email");
		const total = await DocuSignTemplate.countDocuments(query);
		return res.status(200).json({
			success: true,
			data: templates,
			pagination: {
				current: parseInt(page),
				pages: Math.ceil(total / parseInt(limit)),
				total,
				limit: parseInt(limit),
			},
		});
	} catch (error) {
		return res
			.status(500)
			.json({ success: false, message: error.message || "Failed to list templates" });
	}
};

// Apply signatures to template
export const applySignatures = async (req, res) => {
	try {
		const { templateId } = req.params;
		const { signatures, fields: incomingFields } = req.body || {};
		const viewport = (req.body && (req.body.viewport || req.body.pageViewport)) || {};
		const template = await DocuSignTemplate.findById(templateId);
		if (!template) return res.status(404).json({ success: false, message: "Template not found" });
		const templateDir = path.join(TEMPLATES_DIR, templateId);
		const signedDir = path.join(BASE_DIR, "signed", templateId);

		if (!fs.existsSync(signedDir)) fs.mkdirSync(signedDir, { recursive: true });
		const providedById = new Map();
		if (Array.isArray(signatures)) {
			for (const s of signatures) {
				try {
					let buf = null;
					const raw = s.signatureImageBuffer || s.image || s.dataUrl || s.dataURL;
					if (typeof raw === "string") {
						// Data URL (base64)
						const trimmed = raw.trim();
						if (/^data:image\/[a-zA-Z0-9+.-]+;base64,/.test(trimmed)) {
							const b64 = trimmed.replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, "");
							if (b64) buf = Buffer.from(b64, "base64");
						} else if (/^https?:\/\//.test(trimmed) || /^\/\//.test(trimmed)) {
							// Remote URL - try to fetch image and convert to buffer
							try {
								const fetchUrl = trimmed.startsWith("//") ? `https:${trimmed}` : trimmed;
								const resp = await fetch(fetchUrl);
								if (resp && resp.ok) {
									const ab = await resp.arrayBuffer();
									buf = Buffer.from(ab);
								}
							} catch (fetchErr) {
								// continue - buf will remain null and overlay will be generated from text
								console.warn(
									"[WARN] Failed to fetch remote signature image",
									fetchErr?.message || fetchErr
								);
							}
						}
					} else if (Buffer.isBuffer(s.signatureImageBuffer)) {
						buf = s.signatureImageBuffer;
					}
					if (buf) {
						const key1 = s.id;
						const key2 = `${s.pageNumber}:${s.recipientId}:${s.type}`;
						if (key1) providedById.set(key1, buf);
						providedById.set(key2, buf);
					}
				} catch { }
			}
		}

		// Select fields: prefer incoming fields, else from DB
		let sourceFields =
			Array.isArray(incomingFields) && incomingFields.length > 0
				? incomingFields
				: template.signatureFields || [];

		// Expand applyTo and normalize pageNumber type
		if (Array.isArray(sourceFields) && sourceFields.length > 0) {
			const pagesMeta = template.metadata?.pages || [];
			const expanded = [];
			for (const f of sourceFields) {
				const pn = Number(f.pageNumber);
				const vp = viewport?.[pn] || viewport?.[String(pn)] || {};

				let baseW = f.viewportWidth || f.uiWidth || vp?.width;
				let baseH = f.viewportHeight || f.uiHeight || vp?.height;

				if (!baseW || !baseH) {
					const pageData = template.metadata?.pages?.find((p) => p.pageNumber === pn);
					const pageAspectRatio =
						pageData?.width && pageData?.height ? pageData.width / pageData.height : 1.33;

					if (pageAspectRatio > 1.5) {
						baseW = 1000;
						baseH = Math.round(1000 / pageAspectRatio);
					} else {
						baseW = 800;
						baseH = Math.round(800 / pageAspectRatio);
					}
				}

				const xPct = f.xPct != null ? f.xPct : baseW && f.x != null ? f.x / baseW : undefined;
				const yPct = f.yPct != null ? f.yPct : baseH && f.y != null ? f.y / baseH : undefined;
				const wPct =
					f.wPct != null ? f.wPct : baseW && f.width != null ? f.width / baseW : undefined;
				const hPct =
					f.hPct != null ? f.hPct : baseH && f.height != null ? f.height / baseH : undefined;
				const base = {
					id: f.id,
					recipientId: f.recipientId,
					type: f.type,
					xPct,
					yPct,
					wPct,
					hPct,
					x: f.x,
					y: f.y,
					width: f.width,
					height: f.height,
				};
				if (f.applyTo === "all") {
					for (const p of pagesMeta) expanded.push({ ...base, pageNumber: p.pageNumber });
				} else {
					expanded.push({ ...base, pageNumber: pn });
				}
			}
			sourceFields = expanded;
		}

		// Ensure template directory exists
		if (!fs.existsSync(templateDir)) {
			console.warn(`[WARN] Template directory does not exist: ${templateDir}`);
			console.log(`[DEBUG] Creating template directory and placeholder images...`);
			fs.mkdirSync(templateDir, { recursive: true });
		}

		const signedPages = [];
		console.log(`[DEBUG] Processing ${template.metadata.pages.length} pages for template ${templateId}`);

		for (const pageData of template.metadata.pages) {
			const pageNumber = pageData.pageNumber;
			const originalImagePath = path.join(templateDir, `page_${pageNumber}.png`);
			const signedImagePath = path.join(signedDir, `signed_page_${pageNumber}.png`);

			console.log(`[DEBUG] Checking page ${pageNumber}: ${originalImagePath}`);
			console.log(`[DEBUG] Original image exists: ${fs.existsSync(originalImagePath)}`);

			if (!fs.existsSync(originalImagePath)) {
				console.warn(`[WARN] Original image not found for page ${pageNumber}: ${originalImagePath}`);

				// List all files in the template directory to debug
				try {
					if (fs.existsSync(templateDir)) {
						const filesInDir = fs.readdirSync(templateDir);
						console.log(`[DEBUG] Files in template directory:`, filesInDir);
					}
				} catch (err) {
					console.error(`[ERROR] Could not read template directory: ${templateDir}`, err);
				}

				// Create a placeholder image for this page
				console.log(`[DEBUG] Creating placeholder image for page ${pageNumber}`);
				try {
					await sharp({
						create: {
							width: 1920,
							height: 2715, // A4 aspect ratio
							channels: 3,
							background: { r: 255, g: 255, b: 255 }
						}
					})
						.png()
						.composite([{
							input: Buffer.from(`
							<svg width="1920" height="2715">
								<rect width="100%" height="100%" fill="white" stroke="#ddd" stroke-width="2"/>
								<text x="960" y="1200" text-anchor="middle" font-family="Arial" font-size="48" fill="#666">
									Document Page ${pageNumber}
								</text>
								<text x="960" y="1280" text-anchor="middle" font-family="Arial" font-size="32" fill="#999">
									PDF conversion failed - using placeholder
								</text>
								<text x="960" y="1360" text-anchor="middle" font-family="Arial" font-size="24" fill="#bbb">
									You can still add signature fields and test the functionality
								</text>
							</svg>
						`),
							top: 0,
							left: 0
						}])
						.toFile(originalImagePath);

					console.log(`[DEBUG] Created placeholder image: ${originalImagePath}`);
				} catch (placeholderError) {
					console.error(`[ERROR] Failed to create placeholder image for page ${pageNumber}:`, placeholderError);
					continue;
				}
			}

			let pageWidth = pageData.width || 0;
			let pageHeight = pageData.height || 0;
			if (!pageWidth || !pageHeight) {
				try {
					const meta = await sharp(originalImagePath).metadata();
					pageWidth = meta.width || pageWidth;
					pageHeight = meta.height || pageHeight;
				} catch { }
			}

			const overlays = [];
			const pageFields = (sourceFields || []).filter(
				(f) => Number(f.pageNumber) === Number(pageNumber)
			);

			// Diagnostic logging to help debug overlay creation
			try {
				console.debug(
					`[DEBUG] applySignatures: template=${templateId} page=${pageNumber} pageFields=${pageFields.length} providedById=${providedById.size}`
				);
			} catch (e) {
				// ignore logging failures
			}

			for (const field of pageFields) {
				try {
					const defaultW = 160,
						defaultH = 48;
					const pn = Number(field.pageNumber || pageNumber);
					const vp = viewport?.[pn] || viewport?.[String(pn)] || {};

					let baseW = field.viewportWidth || field.uiWidth || vp?.width;
					let baseH = field.viewportHeight || field.uiHeight || vp?.height;

					if (!baseW || !baseH) {
						const pageAspectRatio = pageWidth && pageHeight ? pageWidth / pageHeight : 1.33;
						if (pageAspectRatio > 1.5) {
							baseW = 1000;
							baseH = Math.round(1000 / pageAspectRatio);
						} else {
							baseW = 800;
							baseH = Math.round(800 / pageAspectRatio);
						}
					}

					const xPct =
						field.xPct != null
							? field.xPct
							: baseW && field.x != null
								? field.x / baseW
								: undefined;
					const yPct =
						field.yPct != null
							? field.yPct
							: baseH && field.y != null
								? field.y / baseH
								: undefined;
					const wPct =
						field.wPct != null
							? field.wPct
							: baseW && field.width != null
								? field.width / baseW
								: undefined;
					const hPct =
						field.hPct != null
							? field.hPct
							: baseH && field.height != null
								? field.height / baseH
								: undefined;

					// Normalize percentage values: callers may send percentages as 0..1 or 0..100
					const normalizePct = (v) => (v != null ? (v > 1 ? v / 100 : v) : v);
					const xFrac = normalizePct(xPct);
					const yFrac = normalizePct(yPct);
					const wFrac = normalizePct(wPct);
					const hFrac = normalizePct(hPct);

					const targetW = Math.max(
						1,
						Math.round(wFrac != null && pageWidth ? wFrac * pageWidth : field.width || defaultW)
					);
					const targetH = Math.max(
						1,
						Math.round(hFrac != null && pageHeight ? hFrac * pageHeight : field.height || defaultH)
					);
					const leftPx = Math.max(
						0,
						Math.round(xFrac != null && pageWidth ? xFrac * pageWidth : field.x || 0)
					);
					const topPx = Math.max(
						0,
						Math.round(yFrac != null && pageHeight ? yFrac * pageHeight : field.y || 0)
					);

					let overlayBuffer;
					const providedBuf = field.id
						? providedById.get(field.id) ||
						providedById.get(`${pageNumber}:${field.recipientId}:${field.type}`)
						: providedById.get(`${pageNumber}:${field.recipientId}:${field.type}`);

					if (providedBuf && providedBuf.length > 0) {
						overlayBuffer = await sharp(providedBuf)
							.resize(targetW, targetH, {
								fit: "contain",
								background: { r: 0, g: 0, b: 0, alpha: 0 },
							})
							.png()
							.toBuffer();
					} else {
						// Get user information for signature fields
						const user = req.user;
						const getUserDisplayName = () => {
							if (user?.firstName && user?.lastName) {
								return `${user.firstName} ${user.lastName}`;
							} else if (user?.firstName) {
								return user.firstName;
							}
							return "John Doe";
						};

						const getUserInitials = () => {
							if (user?.firstName && user?.lastName) {
								return `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`;
							} else if (user?.firstName) {
								return user.firstName.charAt(0);
							}
							return "JD";
						};

						const label = (() => {
							switch (field.type) {
								case "date":
									return new Date().toLocaleDateString();
								case "signature":
									return field.value || getUserDisplayName();
								case "initial":
									return field.value || getUserInitials();
								case "text":
									return field.value || "TEXT";
								default:
									return field.type.toUpperCase();
							}
						})();
						let fontFamily = "Arial, sans-serif";
						let fontWeight = "normal";
						let fontStyle = "normal";
						switch (field.type) {
							case "signature":
								fontFamily = "'Dancing Script', 'Great Vibes', 'Allura', 'Brush Script MT', cursive";
								fontWeight = "400";
								fontStyle = "italic";
								break;
							case "initial":
								fontFamily = "'Dancing Script', 'Kalam', 'Brush Script MT', cursive";
								fontWeight = "600";
								break;
							case "date":
							case "text":
								fontFamily = "Arial, sans-serif";
								fontWeight = "500";
								break;
						}

						// Calculate font size to match frontend exactly
						let baseFactor, minSize, maxSize;
						switch (field.type) {
							case "signature":
								baseFactor = 0.5;
								minSize = 12;
								maxSize = 32;
								break;
							case "initial":
								baseFactor = 0.65;
								minSize = 10;
								maxSize = 24;
								break;
							case "date":
							case "text":
								baseFactor = 0.35;
								minSize = 12;
								maxSize = 18;
								break;
							default:
								baseFactor = 0.35;
								minSize = 12;
								maxSize = 18;
						}

						const fontSize = Math.min(
							Math.max(targetH * baseFactor, minSize),
							maxSize
						);
						const svg = `<svg width="${targetW}" height="${targetH}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="white" fill-opacity="0" /><text x="8" y="${Math.max(
							1,
							Math.round(fontSize)
						)}" font-family="${fontFamily}" font-weight="${fontWeight}" font-style="${fontStyle}" font-size="${Math.round(
							fontSize
						)}" fill="black">${label}</text></svg>`;
						overlayBuffer = await sharp(Buffer.from(svg)).png().toBuffer();
					}

					const clampedLeft = pageWidth
						? Math.min(leftPx, Math.max(0, pageWidth - targetW))
						: leftPx;
					const clampedTop = pageHeight
						? Math.min(topPx, Math.max(0, pageHeight - targetH))
						: topPx;
					overlays.push({ input: overlayBuffer, left: clampedLeft, top: clampedTop });
				} catch (err) {
					// Log per-field errors to aid debugging
					try {
						console.error(
							`[ERROR] overlay generation failed for template=${templateId} page=${pageNumber} field=${field && (field.id || field.type || "unknown")
							}:`,
							err && (err.stack || err.message || err)
						);
					} catch (e) { }
				}
			}

			try {
				if (overlays.length === 0) {
					console.warn(
						`[WARN] No overlays generated for template=${templateId} page=${pageNumber}. Copying original image without signatures.`
					);
					fs.copyFileSync(originalImagePath, signedImagePath);
				} else {
					console.debug(
						`[DEBUG] Compositing ${overlays.length} overlay(s) onto template=${templateId} page=${pageNumber}`
					);
					await sharp(originalImagePath).composite(overlays).png().toFile(signedImagePath);
				}
			} catch (compErr) {
				console.error(
					`[ERROR] Failed to composite overlays for template=${templateId} page=${pageNumber}:`,
					compErr && (compErr.stack || compErr.message || compErr)
				);
				// Fallback - copy original so endpoint still returns something
				try {
					fs.copyFileSync(originalImagePath, signedImagePath);
				} catch (e) { }
			}

			signedPages.push({
				pageNumber,
				signedImageUrl: `/uploads/signatures/signed/${templateId}/signed_page_${pageNumber}.png`,
				originalImageUrl: pageData.imageUrl,
			});
		}

		// Add signature completion to audit trail with IP tracking
		try {
			const clientIP = ipLocationService.extractIPAddress(req);
			const location = await ipLocationService.getLocationFromIP(clientIP);

			template.forceAuditTrail = true;
			template.auditDetails = `Document signed from ${location.city || "Unknown"}, ${location.country || "Unknown"
				}`;
			template.auditContext = {
				action: "signed",
				ipAddress: clientIP,
				location: {
					country: location.country,
					city: location.city,
					region: location.regionName,
				},
			};
		} catch (trackingError) {
			console.error("[ERROR] Failed to add IP tracking to audit trail:", trackingError);
			template.forceAuditTrail = true;
			template.auditDetails = "Document signed";
			template.auditContext = { action: "signed" };
		}

		template.status = "final";
		template.finalImageUrl = signedPages[0]?.signedImageUrl || "";
		await template.save();

		console.log(`[DEBUG] Generated ${signedPages.length} signed pages for template ${templateId}`);
		console.log(`[DEBUG] Signed pages:`, signedPages.map(p => ({ pageNumber: p.pageNumber, url: p.signedImageUrl })));

		// Log activity with IP tracking
		await logDocuSignActivity(
			req.user?.id,
			"DOCUSIGN_TEMPLATE_SIGNED",
			`Signatures applied to DocuSign template: ${template.name}`,
			{
				templateId: template._id,
				name: template.name,
				signatureCount: signatures?.length || 0,
				clientIP: ipLocationService.extractIPAddress(req),
			},
			req
		);

		return res.status(200).json({
			success: true,
			data: { templateId, signedPages, message: "Signatures applied successfully" },
		});
	} catch (error) {
		return res
			.status(500)
			.json({ success: false, message: error.message || "Failed to apply signatures" });
	}
};

// Get signed document
export const getSignedDocument = async (req, res) => {
	try {
		const { templateId } = req.params;
		const template = await DocuSignTemplate.findById(templateId);
		if (!template) return res.status(404).json({ success: false, message: "Template not found" });
		if (template.status !== "final")
			return res.status(400).json({ success: false, message: "Template has not been signed yet" });
		const signedDir = path.join(BASE_DIR, "signed", templateId);
		const signedPages = [];
		for (const pageData of template.metadata.pages) {
			const pageNumber = pageData.pageNumber;
			const signedImagePath = path.join(signedDir, `signed_page_${pageNumber}.png`);
			if (fs.existsSync(signedImagePath))
				signedPages.push({
					pageNumber,
					signedImageUrl: `/uploads/signatures/signed/${templateId}/signed_page_${pageNumber}.png`,
				});
		}
		return res.status(200).json({ success: true, data: { template, signedPages } });
	} catch (error) {
		return res
			.status(500)
			.json({ success: false, message: error.message || "Failed to get signed document" });
	}
};

// Update template status
export const updateTemplateStatus = async (req, res) => {
	try {
		const { templateId } = req.params;
		const { status, docusignStatus, recipients } = req.body;
		const userId = req.user?.id;

		const template = await DocuSignTemplate.findOne({
			$or: [{ _id: templateId }, { "metadata.fileId": templateId }],
			isArchived: false,
		});

		if (!template) return res.status(404).json({ success: false, message: "Template not found" });

		if (status) template.status = status;
		if (docusignStatus) template.docusignStatus = docusignStatus;
		if (recipients) template.recipients = recipients;
		template.updatedBy = userId;

		// Add audit trail entry with IP/location for status updates
		try {
			const clientIP = ipLocationService.extractIPAddress(req);
			const location = await ipLocationService.getLocationFromIP(clientIP);

			template.forceAuditTrail = true;
			template.auditDetails = `Status updated to ${status || docusignStatus}`;
			template.auditContext = {
				ipAddress: clientIP,
				location: {
					country: location.country,
					city: location.city,
					region: location.regionName,
				},
			};
		} catch (error) {
			console.error("Failed to get location for audit trail:", error);
			template.forceAuditTrail = true;
			template.auditDetails = `Status updated to ${status || docusignStatus}`;
		}

		await template.save();

		// Log activity
		let activityType = "DOCUSIGN_TEMPLATE_UPDATED";
		let activityMessage = `Updated DocuSign template: ${template.name}`;

		if (status === "final") {
			activityType = "DOCUSIGN_TEMPLATE_COMPLETED";
			activityMessage = `Completed DocuSign template: ${template.name}`;
		} else if (status === "archived") {
			activityType = "DOCUSIGN_TEMPLATE_ARCHIVED";
			activityMessage = `Archived DocuSign template: ${template.name}`;
		}

		await logDocuSignActivity(userId, activityType, activityMessage, {
			templateId: template._id,
			name: template.name,
			status,
			docusignStatus,
		});

		return res.status(200).json({
			success: true,
			data: template,
			message: "Template status updated successfully",
		});
	} catch (error) {
		return res
			.status(500)
			.json({ success: false, message: error.message || "Failed to update template status" });
	}
};

// Get template status history
export const getTemplateStatusHistory = async (req, res) => {
	try {
		const { templateId } = req.params;

		const template = await DocuSignTemplate.findOne({
			$or: [{ _id: templateId }, { "metadata.fileId": templateId }],
			isArchived: false,
		}).populate("auditTrail.userId", "firstName lastName email");

		if (!template) return res.status(404).json({ success: false, message: "Template not found" });

		return res.status(200).json({
			success: true,
			data: {
				templateId: template._id,
				currentStatus: template.status,
				docusignStatus: template.docusignStatus,
				recipients: template.recipients,
				auditTrail: template.auditTrail,
			},
		});
	} catch (error) {
		return res
			.status(500)
			.json({ success: false, message: error.message || "Failed to get template status history" });
	}
};

// Get templates by status
export const getTemplatesByStatus = async (req, res) => {
	try {
		const { status, docusignStatus, page = 1, limit = 10 } = req.query;
		const query = { isArchived: false };

		if (status) query.status = status;
		if (docusignStatus) query.docusignStatus = docusignStatus;

		const skip = (parseInt(page) - 1) * parseInt(limit);
		const templates = await DocuSignTemplate.find(query)
			.sort({ updatedAt: -1 })
			.skip(skip)
			.limit(parseInt(limit))
			.populate("createdBy", "firstName lastName email");

		const total = await DocuSignTemplate.countDocuments(query);

		return res.status(200).json({
			success: true,
			data: templates,
			pagination: {
				current: parseInt(page),
				pages: Math.ceil(total / parseInt(limit)),
				total,
				limit: parseInt(limit),
			},
		});
	} catch (error) {
		return res
			.status(500)
			.json({ success: false, message: error.message || "Failed to get templates by status" });
	}
};

// Get signature tracking data
export const getSignatureTracking = async (req, res) => {
	try {
		const { templateId } = req.params;

		const template = await DocuSignTemplate.findById(templateId)
			.populate("createdBy", "firstName lastName email")
			.select("name auditTrail createdAt updatedAt");

		if (!template) {
			return res.status(404).json({ success: false, message: "Template not found" });
		}

		// Filter audit trail for signing events with IP data
		const signingEvents = template.auditTrail
			.filter((event) => event.action === "signed" && event.ipAddress)
			.map((event) => ({
				timestamp: event.timestamp,
				ipAddress: event.ipAddress,
				location: event.location,
				details: event.details,
				userId: event.userId,
			}))
			.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

		return res.status(200).json({
			success: true,
			data: {
				templateId: template._id,
				templateName: template.name,
				signingEvents,
				totalSigningEvents: signingEvents.length,
			},
		});
	} catch (error) {
		return res.status(500).json({
			success: false,
			message: error.message || "Failed to get signature tracking data",
		});
	}
};
