import fs from "fs";
import path from "path";
import { PDFDocument, rgb } from "pdf-lib";
import { generatePdfThumbnail } from "../utils/pdfThumbnailGenerator.js";

async function createDummyPdf(pdfPath) {
	const pdfDoc = await PDFDocument.create();
	const page = pdfDoc.addPage([400, 400]);
	page.drawText("Hello World!", {
		x: 50,
		y: 200,
		size: 30,
		color: rgb(0, 0.53, 0.71),
	});
	const pdfBytes = await pdfDoc.save();
	fs.writeFileSync(pdfPath, pdfBytes);
}

async function runTest() {
	const testDir = path.join(process.cwd(), "test-output");
	if (!fs.existsSync(testDir)) {
		fs.mkdirSync(testDir, { recursive: true });
	}

	const pdfPath = path.join(testDir, "test.pdf");
	const thumbnailPath = path.join(testDir, "thumbnail.png");

	try {
		console.log("Setting up test data...");
		await createDummyPdf(pdfPath);
		console.log(`Dummy PDF created: ${pdfPath}`);

		console.log("Running pdfThumbnailGenerator...");
		const result = await generatePdfThumbnail(pdfPath, thumbnailPath);

		if (result.success) {
			console.log("Test Passed!");
			console.log(`Thumbnail generated at: ${result.thumbnailPath}`);
		} else {
			console.error("Test Failed!");
			console.error(`Error: ${result.error}`);
		}
	} catch (err) {
		console.error("An unexpected error occurred during testing:");
		console.error(err);
	} finally {
		// Keep files for manual inspection (or we could clean them up)
		// fs.rmSync(testDir, { recursive: true, force: true });
	}
}

runTest();
