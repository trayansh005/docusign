import mongoose from "mongoose";

const signatureSchema = new mongoose.Schema(
	{
		owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
		filename: { type: String, required: true }, // relative path under /uploads
		originalName: { type: String },
		label: { type: String, default: "" },
		type: { type: String, enum: ["drawn", "typed", "uploaded"], default: "uploaded" },
		fontId: { type: String },
		mimeType: { type: String },
		size: { type: Number },
		width: { type: Number },
		height: { type: Number },
		isDefault: { type: Boolean, default: false },
	},
	{ timestamps: true }
);

signatureSchema.index({ owner: 1 });

const Signature = mongoose.model("Signature", signatureSchema);

export default Signature;
