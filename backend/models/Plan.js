import mongoose from "mongoose";

const planSchema = new mongoose.Schema(
	{
		name: {
			type: String,
			required: true,
			unique: true,
			trim: true,
		},
		description: {
			type: String,
			required: true,
		},
		price: {
			type: Number,
			required: true,
			min: 0,
		},
		currency: {
			type: String,
			default: "USD",
		},
		interval: {
			type: String,
			enum: ["month", "year"],
			required: true,
		},
		features: [
			{
				type: String,
				required: true,
			},
		],
		isActive: {
			type: Boolean,
			default: true,
		},
		maxUsers: {
			type: Number,
			default: 1,
		},
		maxProjects: {
			type: Number,
			default: 1,
		},
		priority: {
			type: Number,
			default: 0,
		},
		stripeProductId: {
			type: String,
			sparse: true,
		},
		stripePriceId: {
			type: String,
			sparse: true,
		},
		stripeLookupKey: {
			type: String,
			sparse: true,
		},
	},
	{ timestamps: true }
);

export default mongoose.model("Plan", planSchema);
