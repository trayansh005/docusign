import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Resolve the absolute path to a template's PDF file
 * Handles both relative paths and various storage scenarios
 */
export function resolveTemplatePdfPath(template) {
	const baseDir = path.join(__dirname, "..", "uploads", "signatures");

	// Try different path candidates in order of preference
	const candidates = [];

	// 1. metadata.originalPdfPath (relative path)
	if (template.metadata?.originalPdfPath) {
		const relPath = template.metadata.originalPdfPath.replace(/^\//, "");
		candidates.push(path.join(__dirname, "..", relPath));
	}

	// 2. Direct path in templates directory using template ID
	if (template._id) {
		const templateDir = path.join(baseDir, "templates", template._id.toString());
		if (fs.existsSync(templateDir)) {
			const files = fs.readdirSync(templateDir);
			const pdfFile = files.find((f) => f.endsWith(".pdf"));
			if (pdfFile) {
				candidates.push(path.join(templateDir, pdfFile));
			}
		}
	}

	// 3. Using fileId if available
	if (template.metadata?.fileId) {
		candidates.push(path.join(baseDir, "pdfs", `${template.metadata.fileId}.pdf`));
		candidates.push(path.join(baseDir, "templates", `${template.metadata.fileId}.pdf`));
	}

	// Return the first existing path
	for (const candidate of candidates) {
		if (fs.existsSync(candidate)) {
			return candidate;
		}
	}

	throw new Error(`Could not resolve PDF path for template ${template._id || template.name}`);
}

/**
 * Get the signed PDF output path for a template
 */
export function getSignedPdfPath(templateId) {
	const signedDir = path.join(__dirname, "..", "uploads", "signatures", "signed", templateId.toString());

	// Ensure directory exists
	if (!fs.existsSync(signedDir)) {
		fs.mkdirSync(signedDir, { recursive: true });
	}

	return path.join(signedDir, `${templateId}-final.pdf`);
}

/**
 * Convert absolute path to relative URL for storage
 */
export function pathToUrl(absolutePath) {
	const baseDir = path.join(__dirname, "..");
	const relativePath = path.relative(baseDir, absolutePath);
	return "/" + relativePath.replace(/\\/g, "/");
}
