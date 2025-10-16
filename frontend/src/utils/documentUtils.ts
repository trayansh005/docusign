import { DocuSignTemplateData } from "@/types/docusign";

/**
 * Check if a template represents a Word document
 */
export function isWordDocument(template: DocuSignTemplateData): boolean {
	const mimeType = template.metadata?.mimeType;
	if (!mimeType) return false;

	return (
		mimeType.includes("word") ||
		mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
		mimeType === "application/msword"
	);
}

/**
 * Check if a template represents a PDF document
 */
export function isPdfDocument(template: DocuSignTemplateData): boolean {
	const mimeType = template.metadata?.mimeType;
	if (!mimeType) return false;

	return mimeType === "application/pdf";
}

/**
 * Get the PDF URL for a template (both PDFs and Word docs are served as PDFs)
 */
// _pageNumber is intentionally unused (function resolves general URL regardless of page)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function getTemplatePageImageUrl(
	template: DocuSignTemplateData,
	_pageNumber: number
): string {
	// All documents (PDF and Word) are now served as PDFs
	// Word documents are converted to PDF on the backend

	// Fallback for old templates that might not have pdfUrl
	if (template.pdfUrl) {
		return template.pdfUrl;
	}

	// Try to construct from metadata
	if (template.metadata?.originalPdfPath) {
		return template.metadata.originalPdfPath;
	}

	// Last resort: construct from template ID
	if (template._id && template.metadata?.filename) {
		return `/api/uploads/signatures/templates/${template._id}/${template.metadata.filename}`;
	}

	console.error("[getTemplatePageImageUrl] No PDF URL found for template:", template);
	return "";
}

/**
 * Get the document type display name
 */
export function getDocumentTypeName(template: DocuSignTemplateData): string {
	if (isWordDocument(template)) {
		return "Word Document";
	} else if (isPdfDocument(template)) {
		return "PDF Document";
	}
	return "Document";
}

/**
 * Get the file extension from mime type
 */
export function getFileExtensionFromMimeType(mimeType: string): string {
	switch (mimeType) {
		case "application/pdf":
			return ".pdf";
		case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
			return ".docx";
		case "application/msword":
			return ".doc";
		default:
			return "";
	}
}
