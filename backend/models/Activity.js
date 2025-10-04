import mongoose from "mongoose";

const activitySchema = new mongoose.Schema(
	{
		user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
		type: { type: String, required: true },
		message: { type: String, required: true },
		details: { type: mongoose.Schema.Types.Mixed },
	},
	{ timestamps: true }
);

const Activity = mongoose.model("Activity", activitySchema);
export default Activity;
