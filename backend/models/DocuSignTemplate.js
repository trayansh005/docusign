import mongoose from "mongoose";

const signatureFieldSchema = new mongoose.Schema(
	{
		id: {
			type: String,
			required: true,
		},
		recipientId: {
			type: String,
			required: true,
		},
		type: {
			type: String,
			enum: ["signature", "date", "initial", "text"],
			required: true,
		},
		pageNumber: {
			type: Number,
			required: true,
			min: 1,
		},
		// Absolute pixel coordinates (legacy). Kept for backward compatibility.
		x: {
			type: Number,
			min: 0,
		},
		y: {
			type: Number,
			min: 0,
		},
		width: {
			type: Number,
			min: 1,
		},
		height: {
			type: Number,
			min: 1,
		},
		// Normalized coordinates in [0,1] relative to page dimensions (preferred)
		xPct: { type: Number, min: 0, max: 1 },
		yPct: { type: Number, min: 0, max: 1 },
		wPct: { type: Number, min: 0, max: 1 },
		hPct: { type: Number, min: 0, max: 1 },
		// Font selection for signature fields
		fontId: {
			type: String,
			default: "dancing-script",
		},
		value: {
			type: String,
		},
	},
	{ _id: false }
);

// Recipient schema - users who need to sign the document
const recipientSchema = new mongoose.Schema(
	{
		id: {
			type: String,
			required: true,
		},
		name: {
			type: String,
			required: true,
		},
		email: {
			type: String,
		},
		// Reference to User model if the recipient is a registered user
		userId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "User",
		},
		// Status of this recipient's signature
		signatureStatus: {
			type: String,
			enum: ["pending", "signed", "declined"],
			default: "pending",
		},
		// When the recipient signed
		signedAt: {
			type: Date,
		},
		// Notification tracking
		notifiedAt: {
			type: Date,
		},
	},
	{ _id: false }
);

const templateSchema = new mongoose.Schema(
	{
		name: {
			type: String,
			required: true,
			trim: true,
		},
		type: {
			type: String,
			enum: ["signature", "document", "form"],
			default: "signature",
		},
		// URL to the final generated/signed PDF for the template (stored as path like '/uploads/...')
		finalPdfUrl: {
			type: String,
		},
		pageNumber: {
			type: Number,
			default: 1,
			min: 1,
		},
		numPages: {
			type: Number,
			default: 1,
			min: 1,
		},
		signatureFields: [signatureFieldSchema],
		// Recipients - users who need to sign the document
		recipients: [recipientSchema],
		// Message sent with the document
		message: {
			subject: { type: String, default: "" },
			body: { type: String, default: "" },
		},
		status: {
			type: String,
			enum: ["draft", "active", "final", "archived", "processing", "failed"],
			default: "draft",
		},
		metadata: {
			// Lightweight metadata for quick lookups
			fileId: { type: String, sparse: true },
			filename: { type: String },
			mimeType: { type: String, default: "application/pdf" },
			fileSize: Number,
			originalPdfPath: String,
			// Reference to DocuSignDocument containing the original PDF
			document: { type: mongoose.Schema.Types.ObjectId, ref: "DocuSignDocument" },
			fileHash: String,
		},
		tags: [
			{
				type: String,
				trim: true,
			},
		],
		createdBy: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "User",
			required: false,
		},
		updatedBy: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "User",
		},
		isArchived: {
			type: Boolean,
			default: false,
		},
	},
	{
		timestamps: true,
		toJSON: { virtuals: true },
		toObject: { virtuals: true },
	}
);

// Indexes for performance
templateSchema.index({ "metadata.fileId": 1 });
templateSchema.index({ createdBy: 1 });
templateSchema.index({ status: 1 });
templateSchema.index({ isArchived: 1 });
templateSchema.index({ type: 1, status: 1 });

// Virtual field for frontend compatibility - provides pdfUrl
templateSchema.virtual("pdfUrl").get(function () {
	return this.metadata?.originalPdfPath || "";
});

// Static methods
templateSchema.statics.findByFileId = function (fileId) {
	return this.findOne({ "metadata.fileId": fileId, isArchived: false });
};

templateSchema.statics.findActiveTemplates = function () {
	return this.find({
		status: { $in: ["draft", "active"] },
		isArchived: false,
	}).sort({ updatedAt: -1 });
};

// Instance methods
templateSchema.methods.addSignatureField = function (field) {
	this.signatureFields.push(field);
	return this.save();
};

templateSchema.methods.removeSignatureField = function (fieldId) {
	this.signatureFields = this.signatureFields.filter((field) => field.id !== fieldId);
	return this.save();
};

templateSchema.methods.updateSignatureField = function (fieldId, updates) {
	const field = this.signatureFields.find((field) => field.id === fieldId);
	if (field) {
		Object.assign(field, updates);
		return this.save();
	}
	throw new Error("Signature field not found");
};

const DocuSignTemplate = mongoose.model("DocuSignTemplate", templateSchema);

export default DocuSignTemplate;
