import fs from "fs";
import path from "path";
import { promisify } from "util";
import { execFile } from "child_process";

const execFileAsync = promisify(execFile);

/**
 * Convert Word document to PDF using LibreOffice headless.
 *
 * Note: We intentionally avoid the deprecated `docx-pdf`/`html-pdf`/PhantomJS chain
 * due to unfixed security advisories and abandoned dependencies.
 */
export async function convertWordToPdf(wordFilePath, outputDir) {
	try {
		console.log(`[WordProcessor] Converting Word to PDF: ${wordFilePath}`);

		// Ensure output directory exists
		if (!fs.existsSync(outputDir)) {
			fs.mkdirSync(outputDir, { recursive: true });
		}

		// Generate output PDF path
		const wordFileName = path.basename(wordFilePath, path.extname(wordFilePath));
		const pdfPath = path.join(outputDir, `${wordFileName}.pdf`);

		console.log(`[WordProcessor] Output PDF path: ${pdfPath}`);

		const libreAvailable = await isLibreOfficeAvailable();
		console.log(`[WordProcessor] libreAvailable=${libreAvailable}`);
		if (!libreAvailable) {
			throw new Error(
				"Word to PDF conversion requires LibreOffice (soffice). Install LibreOffice and ensure `soffice` is on PATH (or set LIBREOFFICE_PATH)."
			);
		}

		return await convertWithLibreOffice(wordFilePath, outputDir);
	} catch (error) {
		console.error(`[WordProcessor] Word to PDF conversion error:`, error);
		throw error;
	}
}

/**
 * Process Word document by converting to PDF, then return PDF path
 * The PDF will be processed by the existing PDF pipeline
 */
export async function processWordDocument(wordFilePath, outputDir, templateId) {
	try {
		// Ensure output directory exists
		if (!fs.existsSync(outputDir)) {
			fs.mkdirSync(outputDir, { recursive: true });
		}

		const filename = path.basename(wordFilePath);
		console.log(`[WordProcessor] Processing Word document: ${filename}`);
		console.log(`[WordProcessor] Output directory: ${outputDir}`);
		console.log(`[WordProcessor] Template ID: ${templateId}`);

		try {
			// Convert Word to PDF (with internal fallback)
			const pdfPath = await convertWordToPdf(wordFilePath, outputDir);
			console.log(`[WordProcessor] Word document converted to PDF: ${pdfPath}`);

			// Return the PDF path so the upload controller can process it
			return {
				success: true,
				pdfPath,
				message: "Word document converted to PDF successfully",
			};
		} catch (conversionError) {
			const msg = conversionError?.message || String(conversionError);
			console.error(`[WordProcessor] Conversion failed:`, msg);

			// Return error info so upload controller can handle it
			return {
				success: false,
				error: msg,
				message: "Word to PDF conversion failed",
			};
		}
	} catch (error) {
		console.error(`[WordProcessor] Error processing Word document:`, error);
		throw error;
	}
}

/**
 * Check if file is a Word document
 */
export function isWordDocument(mimeType) {
	const wordMimeTypes = [
		"application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
		"application/msword", // .doc
	];
	return wordMimeTypes.includes(mimeType);
}

/**
 * Try converting with LibreOffice headless. Requires 'soffice' binary installed on server.
 */
async function convertWithLibreOffice(wordFilePath, outputDir) {
	const inputExists = fs.existsSync(wordFilePath);
	if (!inputExists) {
		throw new Error(`Input file does not exist: ${wordFilePath}`);
	}

	// Determine output file path
	const wordFileName = path.basename(wordFilePath, path.extname(wordFilePath));
	const expectedPdfPath = path.join(outputDir, `${wordFileName}.pdf`);

	// Ensure output directory exists
	if (!fs.existsSync(outputDir)) {
		fs.mkdirSync(outputDir, { recursive: true });
	}

	// Common soffice locations; if not in PATH, try these defaults
	const sofficeCandidates =
		process.platform === "win32"
			? [
					// Windows typical installs (not used on prod, but keeps local compatibility)
					process.env.LIBREOFFICE_PATH,
					"soffice.exe",
			  ].filter(Boolean)
			: [
					process.env.LIBREOFFICE_PATH,
					"soffice",
					"/usr/bin/soffice",
					"/usr/local/bin/soffice",
					"/snap/bin/libreoffice",
			  ].filter(Boolean);

	let lastError = null;
	for (const bin of sofficeCandidates) {
		try {
			console.log(`[WordProcessor] Attempting LibreOffice conversion using: ${bin}`);
			const args = [
				"--headless",
				"--nologo",
				"--nofirststartwizard",
				"--norestore",
				"--convert-to",
				"pdf",
				"--outdir",
				outputDir,
				wordFilePath,
			];

			// Set HOME to a writable folder to avoid profile issues when running as a service
			const env = { ...process.env };
			if (!env.HOME) env.HOME = "/tmp";

			const { stdout, stderr } = await execFileAsync(bin, args, {
				env,
				windowsHide: true,
				timeout: 120000,
			});
			if (stdout) console.log(`[WordProcessor] LibreOffice stdout:`, stdout.slice(0, 2000));
			if (stderr) console.warn(`[WordProcessor] LibreOffice stderr:`, stderr.slice(0, 2000));

			if (fs.existsSync(expectedPdfPath)) {
				const stats = fs.statSync(expectedPdfPath);
				console.log(
					`[WordProcessor] LibreOffice created PDF: ${expectedPdfPath} (${stats.size} bytes)`
				);
				return expectedPdfPath;
			}

			lastError = new Error(`LibreOffice reported success but PDF not found at ${expectedPdfPath}`);
		} catch (err) {
			lastError = err;
			console.warn(`[WordProcessor] LibreOffice attempt failed with ${bin}:`, err?.message || err);
		}
	}

	const hint =
		process.platform === "linux"
			? "Ensure LibreOffice is installed: sudo apt-get update && sudo apt-get install -y libreoffice-core libreoffice-writer fonts-dejavu fonts-liberation"
			: 'Install LibreOffice and ensure "soffice" is on PATH.';
	throw new Error(
		`LibreOffice fallback conversion failed. ${hint}. Last error: ${
			lastError?.message || lastError
		}`
	);
}

/**
 * Check if LibreOffice (soffice) is available on this host.
 */
async function isLibreOfficeAvailable() {
	const candidates = getSofficeCandidates();
	for (const bin of candidates) {
		try {
			const { stdout } = await execFileAsync(bin, ["--version"], {
				windowsHide: true,
				timeout: 5000,
			});
			if (stdout) return true;
		} catch (_) {
			// try next
		}
	}
	return false;
}

function getSofficeCandidates() {
	return process.platform === "win32"
		? [process.env.LIBREOFFICE_PATH, "soffice.exe"].filter(Boolean)
		: [
				process.env.LIBREOFFICE_PATH,
				"soffice",
				"/usr/bin/soffice",
				"/usr/local/bin/soffice",
				"/snap/bin/libreoffice",
		  ].filter(Boolean);
}
