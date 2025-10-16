import mongoose from "mongoose";

const subscriptionSchema = new mongoose.Schema(
	{
		userId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "User",
			required: true,
		},
		planId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "Plan",
			required: true,
		},
		status: {
			type: String,
			enum: ["active", "inactive", "cancelled", "expired"],
			default: "active",
		},
		startDate: {
			type: Date,
			default: Date.now,
		},
		endDate: {
			type: Date,
			required: false,
		},
		// If true, the subscription will be canceled at the end of the current billing period
		cancelAtPeriodEnd: {
			type: Boolean,
			default: false,
		},

		// Timestamp when subscription was cancelled immediately
		cancelledAt: {
			type: Date,
			required: false,
		},
		autoRenew: {
			type: Boolean,
			default: true,
		},
		paymentMethod: {
			type: String,
			enum: ["stripe", "paypal", "manual"],
			default: "manual",
		},
		externalSubscriptionId: {
			type: String,
			sparse: true,
		},
		price: { type: Number, required: false },
	},
	{ timestamps: true }
);

// Indexes for efficient queries
subscriptionSchema.index({ userId: 1, status: 1 });
subscriptionSchema.index({ endDate: 1, status: 1 });
subscriptionSchema.index({ userId: 1, createdAt: -1 });
subscriptionSchema.index({ planId: 1, status: 1 });
subscriptionSchema.index({ status: 1, autoRenew: 1, endDate: 1 });
subscriptionSchema.index({ externalSubscriptionId: 1 });

export default mongoose.model("Subscription", subscriptionSchema);
