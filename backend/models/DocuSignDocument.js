import mongoose from "mongoose";

const pageSchema = new mongoose.Schema(
	{
		pageNumber: { type: Number, required: true },
		imageUrl: { type: String, required: false },
		imageHash: { type: String, sparse: true },
		fileSize: Number,
		width: { type: Number, min: 1 },
		height: { type: Number, min: 1 },
	},
	{ _id: false }
);

const docSchema = new mongoose.Schema(
	{
		// Original uploaded file id (storage service / GridFS / S3 key)
		fileId: { type: String, sparse: true },
		filename: { type: String },
		mimeType: { type: String, default: "application/pdf" },
		fileSize: Number,
		// Path to the original PDF on disk or remote URL
		originalPdfPath: String,
		// Path to the final signed PDF (when signatures are applied)
		finalPdfPath: { type: String },
		// Hash for the final signed PDF (for deduplication)
		finalPdfHash: { type: String, sparse: true },
		// Size of the final signed PDF
		finalPdfSize: { type: Number },
		// New: file/pdf hash for deduplication of original uploads (preferred).
		fileHash: { type: String, sparse: true },
		// Number of pages in the PDF
		numPages: { type: Number, default: 1, min: 1 },
		// Per-page metadata for images derived from the PDF
		pages: [pageSchema],
		// Processing status for ingestion/thumbnailing
		status: {
			type: String,
			enum: ["pending", "processing", "ready", "signed", "failed"],
			default: "pending",
		},
		// Link back to a template (one-to-one) if the document is attached to a template
		template: { type: mongoose.Schema.Types.ObjectId, ref: "DocuSignTemplate" },
	},
	{ timestamps: true }
);

docSchema.index({ fileId: 1 });
docSchema.index({ fileHash: 1 });

docSchema.statics.findByFileId = function (fileId) {
	return this.findOne({ fileId });
};

docSchema.statics.findByFileHash = function (fileHash) {
	return this.findOne({ fileHash });
};

const DocuSignDocument = mongoose.model("DocuSignDocument", docSchema);

export default DocuSignDocument;
