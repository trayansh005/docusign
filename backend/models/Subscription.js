import mongoose from "mongoose";

const subscriptionSchema = new mongoose.Schema({
	user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
	plan: { type: String, required: true }, // e.g., 'basic', 'premium'
	status: { type: String, enum: ["active", "inactive", "cancelled"], default: "active" },
	startDate: { type: Date, default: Date.now },
	endDate: { type: Date },
	price: { type: Number, required: true },
});

export default mongoose.model("Subscription", subscriptionSchema);
