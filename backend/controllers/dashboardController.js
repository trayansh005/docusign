import DocuSignTemplate from "../models/DocuSignTemplate.js";
import Subscription from "../models/Subscription.js";
import { getFreeTierLimits } from "../utils/freeTierLimits.js";

// GET /api/dashboard/stats
export const getUserStats = async (req, res) => {
	try {
		const userId = req.user?.id || req.user?._id;
		const email = req.user?.email;

		if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

		// Phase 2 Optimization: Use aggregation pipeline for owner stats (1 query instead of 3)
		const ownerStatsResult = await DocuSignTemplate.aggregate([
			{
				$match: {
					createdBy: userId,
					isArchived: { $ne: true },
				},
			},
			{
				$group: {
					_id: null,
					total: { $sum: 1 },
					pending: { $sum: { $cond: [{ $ne: ["$status", "final"] }, 1, 0] } },
					completed: { $sum: { $cond: [{ $eq: ["$status", "final"] }, 1, 0] } },
				},
			},
		]);

		const ownerStats = ownerStatsResult[0] || { total: 0, pending: 0, completed: 0 };

		// Build assigned filter with $or conditions
		const assignedOrConditions = [
			{ "signatureFields.recipientId": String(userId) },
			{ "recipients.userId": userId },
			{ "recipients.id": String(userId) },
		];
		if (email) {
			assignedOrConditions.push({ "recipients.email": email });
		}

		// Phase 2 Optimization: Use aggregation pipeline for assigned stats (1 query instead of 3)
		const assignedStatsResult = await DocuSignTemplate.aggregate([
			{
				$match: {
					isArchived: { $ne: true },
					$or: assignedOrConditions,
				},
			},
			{
				$group: {
					_id: null,
					total: { $sum: 1 },
					pending: { $sum: { $cond: [{ $ne: ["$status", "final"] }, 1, 0] } },
					completed: { $sum: { $cond: [{ $eq: ["$status", "final"] }, 1, 0] } },
				},
			},
		]);

		const assignedStats = assignedStatsResult[0] || { total: 0, pending: 0, completed: 0 };

		// Check subscription status
		const now = new Date();
		const activeSub = await Subscription.findOne({
			userId,
			status: "active",
			$or: [{ endDate: { $exists: false } }, { endDate: { $gt: now } }],
		}).select("_id");

		let usage = null;
		if (!activeSub) {
			const { uploadLimit, signedLimit } = getFreeTierLimits();

			// Phase 2 Optimization: Get usage stats with aggregation (replaces 2 more queries)
			const usageResult = await DocuSignTemplate.aggregate([
				{
					$match: {
						createdBy: userId,
						isArchived: { $ne: true },
					},
				},
				{
					$group: {
						_id: null,
						uploadsUsed: { $sum: 1 },
						signUsed: { $sum: { $cond: [{ $eq: ["$status", "final"] }, 1, 0] } },
					},
				},
			]);

			const usageData = usageResult[0] || { uploadsUsed: 0, signUsed: 0 };

			usage = {
				hasActiveSubscription: false,
				uploads: { used: usageData.uploadsUsed, limit: uploadLimit },
				signs: { used: usageData.signUsed, limit: signedLimit },
			};
		} else {
			usage = { hasActiveSubscription: true };
		}

		return res.status(200).json({
			success: true,
			data: {
				owner: {
					total: ownerStats.total,
					pending: ownerStats.pending,
					completed: ownerStats.completed,
				},
				assigned: {
					total: assignedStats.total,
					pending: assignedStats.pending,
					completed: assignedStats.completed,
				},
				usage,
			},
		});
	} catch (error) {
		console.error("getUserStats error", error);
		return res
			.status(500)
			.json({ success: false, message: error.message || "Failed to compute stats" });
	}
};

// GET /api/dashboard/inbox
// Phase 2 Optimization: Add pagination support
export const getInbox = async (req, res) => {
	try {
		const userId = req.user?.id || req.user?._id;
		const email = req.user?.email;
		const { page = 1, limit = 10 } = req.query;

		if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

		// Find templates where the user is a recipient
		const assignedFilter = {
			isArchived: { $ne: true },
			$or: [
				// Match by signature field recipient ID
				{ "signatureFields.recipientId": String(userId) },
				// Match by recipients array - user ID
				{ "recipients.userId": userId },
				// Match by recipients array - recipient ID string
				{ "recipients.id": String(userId) },
			],
		};

		// Also match by email if available
		if (email) {
			assignedFilter.$or.push({ "recipients.email": email });
		}

		// Phase 2 Optimization: Calculate pagination
		const skip = (parseInt(page) - 1) * parseInt(limit);
		const total = await DocuSignTemplate.countDocuments(assignedFilter);

		// Phase 2 Optimization: Fetch only needed fields and paginated results
		const templates = await DocuSignTemplate.find(assignedFilter)
			.sort({ updatedAt: -1 })
			.skip(skip)
			.limit(parseInt(limit))
			.select("name status createdAt updatedAt finalPdfUrl metadata recipients message createdBy")
			.populate("createdBy", "firstName lastName email")
			.lean();

		const items = templates.map((t) => ({
			id: t._id,
			name: t.name || t.metadata?.filename || "Untitled",
			status: t.status,
			createdAt: t.createdAt,
			updatedAt: t.updatedAt,
			finalPdfUrl: t.finalPdfUrl || (t.metadata && t.metadata.originalPdfPath) || "",
			sender: t.createdBy
				? `${t.createdBy.firstName || ""} ${t.createdBy.lastName || ""}`.trim() || t.createdBy.email
				: "Unknown",
			message: t.message || { subject: "", body: "" },
			// Add recipient-specific info
			myRecipientInfo:
				t.recipients?.find(
					(r) =>
						r.userId?.toString() === userId.toString() ||
						r.id === String(userId) ||
						r.email === email
				) || null,
		}));

		return res.status(200).json({
			success: true,
			data: items,
			pagination: {
				current: parseInt(page),
				total,
				pages: Math.ceil(total / parseInt(limit)),
				limit: parseInt(limit),
			},
		});
	} catch (error) {
		console.error("getInbox error", error);
		return res
			.status(500)
			.json({ success: false, message: error.message || "Failed to load inbox" });
	}
};
