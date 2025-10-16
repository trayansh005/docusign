import mongoose from "mongoose";
import dotenv from "dotenv";
import DocuSignDocument from "../models/DocuSignDocument.js";
import DocuSignTemplate from "../models/DocuSignTemplate.js";

// Load environment variables
dotenv.config();

/**
 * Migration script to merge duplicate DocuSignDocument entries
 *
 * Problem: Before the fix, the system created TWO documents per template:
 * 1. One on upload (original PDF)
 * 2. One on signing (final PDF)
 *
 * Solution: Merge them into ONE document with both original and final PDF paths
 */

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017";
const DB_NAME = process.env.DB_NAME || "docusign_app_dev";

async function connectDB() {
	try {
		await mongoose.connect(MONGO_URI, { dbName: DB_NAME });
		console.log(`✅ Connected to MongoDB: ${mongoose.connection.db.databaseName}`);
	} catch (error) {
		console.error("❌ MongoDB connection error:", error);
		process.exit(1);
	}
}

async function mergeDuplicateDocuments() {
	console.log("\n🔍 Starting duplicate document merge...\n");

	try {
		// Get all templates
		const templates = await DocuSignTemplate.find({}).lean();
		console.log(`Found ${templates.length} templates to check`);

		let mergedCount = 0;
		let skippedCount = 0;
		let errorCount = 0;

		for (const template of templates) {
			try {
				const originalDocId = template.metadata?.document;
				const finalDocId = template.metadata?.finalDocument;

				// Skip if no documents or only one document
				if (!originalDocId && !finalDocId) {
					skippedCount++;
					continue;
				}

				if (!finalDocId || originalDocId?.toString() === finalDocId?.toString()) {
					// Only one document or already merged
					skippedCount++;
					continue;
				}

				// Fetch both documents
				const originalDoc = await DocuSignDocument.findById(originalDocId);
				const finalDoc = await DocuSignDocument.findById(finalDocId);

				if (!originalDoc || !finalDoc) {
					console.log(`⚠️  Template ${template._id}: Missing document(s)`);
					skippedCount++;
					continue;
				}

				console.log(`\n📝 Merging documents for template: ${template.name} (${template._id})`);
				console.log(`   Original doc: ${originalDoc._id}`);
				console.log(`   Final doc: ${finalDoc._id}`);

				// Merge final document data into original document
				originalDoc.finalPdfPath = finalDoc.originalPdfPath || template.finalPdfUrl;
				originalDoc.finalPdfHash = finalDoc.fileHash;
				originalDoc.finalPdfSize = finalDoc.fileSize;
				originalDoc.status = "signed";

				// Ensure template reference is set
				if (!originalDoc.template) {
					originalDoc.template = template._id;
				}

				await originalDoc.save();

				// Update template to remove finalDocument reference
				await DocuSignTemplate.findByIdAndUpdate(template._id, {
					$unset: { "metadata.finalDocument": 1 },
				});

				// Delete the duplicate final document
				await DocuSignDocument.findByIdAndDelete(finalDoc._id);

				console.log(`   ✅ Merged and deleted duplicate document`);
				mergedCount++;
			} catch (error) {
				console.error(`❌ Error processing template ${template._id}:`, error.message);
				errorCount++;
			}
		}

		console.log("\n" + "=".repeat(60));
		console.log("📊 Migration Summary:");
		console.log(`   ✅ Merged: ${mergedCount} documents`);
		console.log(`   ⏭️  Skipped: ${skippedCount} templates`);
		console.log(`   ❌ Errors: ${errorCount} templates`);
		console.log("=".repeat(60) + "\n");

		// Verify no orphaned documents remain
		const orphanedDocs = await DocuSignDocument.find({ template: null }).lean();
		if (orphanedDocs.length > 0) {
			console.log(
				`\n⚠️  Found ${orphanedDocs.length} orphaned documents without template reference`
			);
			console.log("   Attempting to link them to templates...\n");

			let linkedCount = 0;
			let deletedCount = 0;
			for (const doc of orphanedDocs) {
				// Try to find a template that references this document
				const linkedTemplate = await DocuSignTemplate.findOne({
					$or: [{ "metadata.document": doc._id }, { "metadata.finalDocument": doc._id }],
				});

				if (linkedTemplate) {
					// Link the document back to the template
					await DocuSignDocument.findByIdAndUpdate(doc._id, {
						template: linkedTemplate._id,
					});
					console.log(`   ✅ Linked document ${doc._id} to template ${linkedTemplate._id}`);
					linkedCount++;
				} else {
					// Check if this is a final document by filename pattern (templateId-final.pdf)
					const finalDocPattern = /([a-f0-9]{24})-final\.pdf/;
					const match = doc.filename?.match(finalDocPattern);

					if (match) {
						const templateId = match[1];
						const possibleTemplate = await DocuSignTemplate.findById(templateId);

						if (possibleTemplate) {
							// This is an orphaned final document - check if the template already has a document
							const existingDoc = await DocuSignDocument.findById(
								possibleTemplate.metadata?.document
							);

							if (existingDoc && !existingDoc.finalPdfPath) {
								// Merge into existing document
								existingDoc.finalPdfPath = doc.originalPdfPath;
								existingDoc.finalPdfHash = doc.fileHash;
								existingDoc.finalPdfSize = doc.fileSize;
								existingDoc.status = "signed";
								await existingDoc.save();

								// Delete the orphaned duplicate
								await DocuSignDocument.findByIdAndDelete(doc._id);
								console.log(
									`   🔄 Merged orphaned final document ${doc._id} into ${existingDoc._id} and deleted duplicate`
								);
								deletedCount++;
							} else {
								// No existing document, link this one
								await DocuSignDocument.findByIdAndUpdate(doc._id, {
									template: possibleTemplate._id,
								});
								possibleTemplate.metadata = possibleTemplate.metadata || {};
								possibleTemplate.metadata.document = doc._id;
								await possibleTemplate.save();
								console.log(
									`   ✅ Linked orphaned final document ${doc._id} to template ${templateId}`
								);
								linkedCount++;
							}
						} else {
							console.log(
								`   ⚠️  Could not find template ${templateId} for document ${doc._id} (${doc.filename})`
							);
						}
					} else {
						console.log(`   ⚠️  Could not find template for document ${doc._id} (${doc.filename})`);
					}
				}
			}

			if (linkedCount > 0 || deletedCount > 0) {
				console.log(`\n   ✅ Linked ${linkedCount} orphaned documents to templates`);
				console.log(`   🗑️  Deleted ${deletedCount} duplicate documents`);
			}
		}
	} catch (error) {
		console.error("❌ Migration failed:", error);
		throw error;
	}
}

async function main() {
	try {
		await connectDB();
		await mergeDuplicateDocuments();
		console.log("\n✅ Migration completed successfully!");
	} catch (error) {
		console.error("\n❌ Migration failed:", error);
		process.exit(1);
	} finally {
		await mongoose.connection.close();
		console.log("👋 Database connection closed");
		process.exit(0);
	}
}

// Run the migration
main();
