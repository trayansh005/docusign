import fs from "fs";
import path from "path";
import { pdf } from "pdf-to-img";

/**
 * Convert PDF first page to PNG thumbnail using pdf-to-img
 *
 * @param {string} pdfPath - Path to the PDF file
 * @param {string} outputPath - Path for the output PNG file
 * @returns {Promise<{success: boolean, thumbnailPath?: string, error?: string}>}
 */
export async function generatePdfThumbnail(pdfPath, outputPath) {
	try {
		// Ensure output directory exists
		const outputDir = path.dirname(outputPath);
		if (!fs.existsSync(outputDir)) {
			fs.mkdirSync(outputDir, { recursive: true });
		}

		// Check if PDF file exists
		if (!fs.existsSync(pdfPath)) {
			throw new Error(`PDF file not found: ${pdfPath}`);
		}

		console.log(`[PDF Thumbnail] Converting PDF: ${pdfPath}`);

		// Convert PDF to images (we only need the first page)
		const document = await pdf(pdfPath, { scale: 2.0 }); // Higher scale for better quality

		// Get the first page
		let pageData = null;
		for await (const page of document) {
			pageData = page;
			break; // We only need the first page
		}

		if (!pageData) {
			throw new Error("PDF has no pages or could not be processed");
		}

		// Save the image
		fs.writeFileSync(outputPath, pageData);

		console.log(`[PDF Thumbnail] Generated: ${outputPath}`);

		return {
			success: true,
			thumbnailPath: outputPath,
		};
	} catch (error) {
		console.error("[PDF Thumbnail] Generation failed:", error);
		return {
			success: false,
			error: error.message,
		};
	}
}
