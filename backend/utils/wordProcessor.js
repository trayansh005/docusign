import fs from "fs";
import path from "path";
import docxConverter from "docx-pdf";
import { promisify } from "util";

const convertAsync = promisify(docxConverter);

/**
 * Convert Word document to PDF using docx-pdf library
 * This is a pure Node.js solution that doesn't require external dependencies
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

        try {
            console.log(`[WordProcessor] Starting docx-pdf conversion...`);
            console.log(`[WordProcessor] Input: ${wordFilePath}`);
            console.log(`[WordProcessor] Output: ${pdfPath}`);
            console.log(`[WordProcessor] Input file exists: ${fs.existsSync(wordFilePath)}`);

            // Convert using docx-pdf
            await convertAsync(wordFilePath, pdfPath);

            console.log(`[WordProcessor] Conversion completed, checking output...`);
            console.log(`[WordProcessor] Output file exists: ${fs.existsSync(pdfPath)}`);

            if (fs.existsSync(pdfPath)) {
                const stats = fs.statSync(pdfPath);
                console.log(`[WordProcessor] PDF created successfully: ${pdfPath}`);
                console.log(`[WordProcessor] PDF file size: ${stats.size} bytes`);
                return pdfPath;
            } else {
                throw new Error(`PDF file not found at: ${pdfPath}`);
            }

        } catch (conversionError) {
            console.error(`[WordProcessor] docx-pdf conversion failed:`, conversionError);
            console.error(`[WordProcessor] Error message:`, conversionError.message);
            console.error(`[WordProcessor] Error stack:`, conversionError.stack);
            throw new Error(`Word to PDF conversion failed: ${conversionError.message}`);
        }

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
            // Convert Word to PDF
            const pdfPath = await convertWordToPdf(wordFilePath, outputDir);
            console.log(`[WordProcessor] Word document converted to PDF: ${pdfPath}`);

            // Return the PDF path so the upload controller can process it
            return {
                success: true,
                pdfPath,
                message: "Word document converted to PDF successfully"
            };

        } catch (conversionError) {
            console.error(`[WordProcessor] Conversion failed:`, conversionError.message);

            // Return error info so upload controller can handle it
            return {
                success: false,
                error: conversionError.message,
                message: "Word to PDF conversion failed"
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
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
        'application/msword', // .doc
    ];
    return wordMimeTypes.includes(mimeType);
}