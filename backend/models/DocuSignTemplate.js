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
		imageUrl: {
			type: String,
			// required: true, // No longer required on initial creation
		},
		finalImageUrl: {
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
		status: {
			type: String,
			enum: ["draft", "active", "final", "archived", "processing", "failed"], // Added processing and failed
			default: "draft",
		},
		metadata: {
			fileId: {
				type: String,
				// required: true, // No longer required on initial creation
				unique: true,
				sparse: true, // Allows multiple documents to have null/undefined fileId
			},
			filename: {
				type: String,
				required: true,
			},
			imageHash: {
				type: String,
				// required: true, // No longer required on initial creation
				index: true,
				sparse: true, // Allows multiple documents to have null/undefined imageHash
			},
			finalImage: String,
			mimeType: {
				type: String,
				default: "image/png",
			},
			fileSize: Number,
			originalPdfPath: String,
			pages: [
				{
					pageNumber: {
						type: Number,
						required: true,
					},
					imageUrl: {
						type: String,
						required: true,
					},
					imageHash: {
						type: String,
						required: true,
					},
					fileSize: Number,
					// Intrinsic image dimensions for accurate scaling in UI and server-side rendering
					width: { type: Number, min: 1 },
					height: { type: Number, min: 1 },
				},
			],
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
		// DocuSign specific fields
		docusignTemplateId: String,
		docusignStatus: {
			type: String,
			enum: ["draft", "sent", "completed", "declined", "voided"],
		},
		recipients: [
			{
				id: String,
				name: String,
				email: String,
				role: {
					type: String,
					enum: ["signer", "viewer", "approver"],
					default: "signer",
				},
			},
		],
		// Audit trail with IP and location tracking
		auditTrail: [
			{
				action: {
					type: String,
					enum: ["created", "updated", "signed", "viewed", "sent", "completed"],
				},
				userId: {
					type: mongoose.Schema.Types.ObjectId,
					ref: "User",
				},
				timestamp: {
					type: Date,
					default: Date.now,
				},
				details: String,
				// IP and location tracking for signature events
				ipAddress: String,
				location: {
					country: String,
					city: String,
					region: String,
				},
			},
		],
	},
	{
		timestamps: true,
		toJSON: { virtuals: true },
		toObject: { virtuals: true },
	}
);

// Indexes for performance
// Note: metadata.imageHash already has index: true in schema definition
templateSchema.index({ createdBy: 1 });
templateSchema.index({ status: 1 });
templateSchema.index({ isArchived: 1 });
templateSchema.index({ type: 1, status: 1 });

// Virtual for full image URL
templateSchema.virtual("fullImageUrl").get(function () {
	if (this.imageUrl && !this.imageUrl.startsWith("http")) {
		// Backend serves files at /api/uploads on port 8000
		return `${process.env.BACKEND_URL || "http://localhost:8000"}${this.imageUrl}`;
	}
	return this.imageUrl;
});

// Virtual for full final image URL
templateSchema.virtual("fullFinalImageUrl").get(function () {
	if (this.finalImageUrl && !this.finalImageUrl.startsWith("http")) {
		return `${process.env.BASE_URL || "http://localhost:3001"}${this.finalImageUrl}`;
	}
	return this.finalImageUrl;
});

// Pre-save middleware to update audit trail
templateSchema.pre("save", function (next) {
	if (this.isNew) {
		this.auditTrail.push({
			action: "created",
			userId: this.createdBy,
			details: "Template created",
			timestamp: new Date(),
		});
	} else if (this.skipAuditTrail !== true) {
		// Only add audit trail if not explicitly skipped
		// This prevents excessive audit entries during frequent updates like signature field movements
		const shouldAudit =
			this.forceAuditTrail ||
			this.isModified("status") ||
			this.isModified("name") ||
			this.isModified("isArchived") ||
			this.isModified("finalImageUrl");

		if (shouldAudit) {
			const auditContext = this.auditContext || {};
			const action = auditContext.action || "updated"; // Allow overriding action
			const { action: _, ...contextWithoutAction } = auditContext; // Remove action from spread

			this.auditTrail.push({
				action: action,
				userId: this.updatedBy || this.createdBy,
				details: this.auditDetails || "Template updated",
				timestamp: new Date(),
				...contextWithoutAction, // Add IP/location context without action field
			});
		}
	}

	// Reset audit control flags
	this.skipAuditTrail = undefined;
	this.forceAuditTrail = undefined;
	this.auditDetails = undefined;
	this.auditContext = undefined;

	next();
});

// Static methods
templateSchema.statics.findByFileId = function (fileId) {
	return this.findOne({ "metadata.fileId": fileId, isArchived: false });
};

templateSchema.statics.findByImageHash = function (imageHash) {
	return this.findOne({
		"metadata.imageHash": imageHash,
		type: "signature",
		isArchived: false,
	});
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

templateSchema.methods.markAsCompleted = function (userId) {
	this.status = "final";
	this.updatedBy = userId;
	this.auditTrail.push({
		action: "completed",
		userId: userId,
		details: "Template marked as completed",
	});
	return this.save();
};

templateSchema.methods.archive = function (userId) {
	this.isArchived = true;
	this.updatedBy = userId;
	this.auditTrail.push({
		action: "updated",
		userId: userId,
		details: "Template archived",
	});
	return this.save();
};

const DocuSignTemplate = mongoose.model("DocuSignTemplate", templateSchema);

export default DocuSignTemplate;
