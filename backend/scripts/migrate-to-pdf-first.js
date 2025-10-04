import mongoose from "mongoose";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";
import DocuSignTemplate from "../models/DocuSignTemplate.js";
import DocuSignDocument from "../models/DocuSignDocument.js";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, "..", ".env") });

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/docusign";

/**
 * Connect to MongoDB
 */
async function connectDB() {
	try {
		await mongoose.connect(MONGODB_URI);
		console.log("✅ Connected to MongoDB");
	} catch (error) {
		console.error("❌ MongoDB connection error:", error);
		process.exit(1);
	}
}

/**
 * Resolve PDF file path from template
 */
function resolvePdfPath(template) {
	const baseDir = path.join(__dirname, "..", "uploads", "signatures");
	const candidates = [];

	// Try metadata.originalPdfPath
	if (template.metadata?.originalPdfPath) {
		const relPath = template.metadata.originalPdfPath.replace(/^\//, "");
		candidates.push(path.join(__dirname, "..", relPath));
	}

	// Try templates directory with template ID
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

	// Try using fileId
	if (template.metadata?.fileId) {
		candidates.push(path.join(baseDir, "pdfs", `${template.metadata.fileId}.pdf`));
		candidates.push(path.join(baseDir, "templates", `${template.metadata.fileId}.pdf`));
	}

	// Return first existing path
	for (const candidate of candidates) {
		if (fs.existsSync(candidate)) {
			return candidate;
		}
	}

	return null;
}

/**
 * Migrate a single template to PDF-first architecture
 */
async function migrateTemplate(template) {
	try {
		console.log(`\n📄 Migrating template: ${template.name} (${template._id})`);

		// Skip if already migrated (has document reference)
		if (template.metadata?.document) {
			console.log("  ⏭️  Already migrated (has document reference)");
			return { status: "skipped", reason: "already_migrated" };
		}

		// Find PDF file
		const pdfPath = resolvePdfPath(template);
		if (!pdfPath) {
			console.log("  ⚠️  PDF file not found");
			return { status: "skipped", reason: "pdf_not_found" };
		}

		console.log(`  📁 Found PDF: ${pdfPath}`);

		// Read file and calculate hash
		const fileBuffer = fs.readFileSync(pdfPath);
		const fileHash = crypto.createHash("sha256").update(fileBuffer).digest("hex");
		const fileSize = fileBuffer.length;

		console.log(`  🔐 File hash: ${fileHash.substring(0, 16)}...`);

		// Check if document already exists with this hash
		let doc = await DocuSignDocument.findOne({ fileHash });

		if (doc) {
			console.log("  ♻️  Document already exists with this hash");
		} else {
			// Create new DocuSignDocument
			const relativeFilePath = pdfPath
				.replace(path.join(__dirname, ".."), "")
				.replace(/\\/g, "/");

			doc = await DocuSignDocument.create({
				fileId: template.metadata?.fileId || path.parse(pdfPath).name,
				filename: template.metadata?.filename || path.basename(pdfPath),
				mimeType: "application/pdf",
				fileSize,
				originalPdfPath: relativeFilePath.startsWith("/") ? relativeFilePath : `/${relativeFilePath}`,
				fileHash,
				status: "ready",
				template: template._id,
			});

			console.log(`  ✨ Created DocuSignDocument: ${doc._id}`);
		}

		// Update template
		template.metadata = template.metadata || {};
		template.metadata.document = doc._id;
		template.metadata.fileHash = fileHash;
		template.metadata.mimeType = "application/pdf";

		// Clean up old image-based fields
		delete template.metadata.imageHash;
		delete template.metadata.finalImage;
		delete template.metadata.pages;

		// Remove old schema fields
		template.imageUrl = undefined;
		template.finalImageUrl = undefined;
		template.docusignTemplateId = undefined;
		template.docusignStatus = undefined;
		template.recipients = undefined;
		template.auditTrail = undefined;

		await template.save();

		console.log("  ✅ Template migrated successfully");
		return { status: "success" };
	} catch (error) {
		console.error(`  ❌ Error migrating template:`, error.message);
		return { status: "error", error: error.message };
	}
}

/**
 * Main migration function
 */
async function migrate() {
	console.log("🚀 Starting DocuSign PDF-First Migration\n");
	console.log("=" + "=".repeat(50));

	await connectDB();

	try {
		// Find all templates
		const templates = await DocuSignTemplate.find({});
		console.log(`\n📊 Found ${templates.length} templates to process\n`);

		const results = {
			total: templates.length,
			success: 0,
			skipped: 0,
			errors: 0,
			details: [],
		};

		// Process each template
		for (let i = 0; i < templates.length; i++) {
			const template = templates[i];
			console.log(`\n[${i + 1}/${templates.length}]`);

			const result = await migrateTemplate(template);
			results.details.push({
				templateId: template._id,
				name: template.name,
				result,
			});

			if (result.status === "success") results.success++;
			else if (result.status === "skipped") results.skipped++;
			else if (result.status === "error") results.errors++;
		}

		// Print summary
		console.log("\n" + "=" + "=".repeat(50));
		console.log("\n📊 Migration Summary:");
		console.log(`   Total templates: ${results.total}`);
		console.log(`   ✅ Migrated: ${results.success}`);
		console.log(`   ⏭️  Skipped: ${results.skipped}`);
		console.log(`   ❌ Errors: ${results.errors}`);

		// Save migration report
		const reportPath = path.join(__dirname, "..", "migration-report.json");
		fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
		console.log(`\n📝 Detailed report saved to: ${reportPath}`);

		console.log("\n✨ Migration complete!\n");
	} catch (error) {
		console.error("\n❌ Migration failed:", error);
		process.exit(1);
	} finally {
		await mongoose.disconnect();
		console.log("👋 Disconnected from MongoDB");
	}
}

// Run migration
migrate().catch((error) => {
	console.error("Fatal error:", error);
	process.exit(1);
});
