import DocuSignTemplate from "../models/DocuSignTemplate.js";
import Subscription from "../models/Subscription.js";
import { getFreeTierLimits } from "../utils/freeTierLimits.js";

// GET /api/dashboard/stats
export const getUserStats = async (req, res) => {
	try {
		const userId = req.user?.id || req.user?._id;
		const email = req.user?.email;

		if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

		// Owner-scope: documents owned by user
		const ownerFilter = { createdBy: userId, isArchived: { $ne: true } };
		const totalDocuments = await DocuSignTemplate.countDocuments(ownerFilter);
		const ownerPending = await DocuSignTemplate.countDocuments({
			...ownerFilter,
			status: { $ne: "final" },
		});
		const ownerCompleted = await DocuSignTemplate.countDocuments({
			...ownerFilter,
			status: "final",
		});

		// Templates assigned to this user (by signatureFields.recipientId or recipients list)
		const assignedFilter = {
			isArchived: { $ne: true },
			$or: [{ "signatureFields.recipientId": String(userId) }, { "recipients.id": String(userId) }],
		};
		if (email) {
			// also match recipients by email if present
			assignedFilter.$or.push({ "recipients.email": email });
		}

		const pendingSignatures = await DocuSignTemplate.countDocuments({
			...assignedFilter,
			status: { $ne: "final" },
		});

		const completedSignatures = await DocuSignTemplate.countDocuments({
			...assignedFilter,
			status: "final",
		});

		const assignedTotal = await DocuSignTemplate.countDocuments(assignedFilter);

		// Determine free usage if no active subscription
		const now = new Date();
		const activeSub = await Subscription.findOne({
			userId,
			status: "active",
			$or: [{ endDate: { $exists: false } }, { endDate: { $gt: now } }],
		});

		let usage = null;
		if (!activeSub) {
			const { uploadLimit, signedLimit } = getFreeTierLimits();
			// Uploads used = number of non-archived templates owned by user
			const uploadsUsed = totalDocuments;
			// Signed used = number of owned templates that are in final status
			const signUsed = await DocuSignTemplate.countDocuments({
				createdBy: userId,
				isArchived: { $ne: true },
				status: "final",
			});
			usage = {
				hasActiveSubscription: false,
				uploads: { used: uploadsUsed, limit: uploadLimit },
				signs: { used: signUsed, limit: signedLimit },
			};
		} else {
			usage = { hasActiveSubscription: true };
		}

		return res.status(200).json({
			success: true,
			data: {
				// Backward compatible flat fields used by existing UI cards
				totalDocuments, // owner total
				pendingSignatures, // assigned pending
				completedSignatures, // assigned completed
				// New grouped stats for Option C rendering
				owner: {
					total: totalDocuments,
					pending: ownerPending,
					completed: ownerCompleted,
				},
				assigned: {
					total: assignedTotal,
					pending: pendingSignatures,
					completed: completedSignatures,
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
export const getInbox = async (req, res) => {
	try {
		const userId = req.user?.id || req.user?._id;
		const email = req.user?.email;
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

		const templates = await DocuSignTemplate.find(assignedFilter)
			.sort({ updatedAt: -1 })
			.select("name status createdAt updatedAt finalPdfUrl metadata recipients message")
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

		return res.status(200).json({ success: true, data: items });
	} catch (error) {
		console.error("getInbox error", error);
		return res
			.status(500)
			.json({ success: false, message: error.message || "Failed to load inbox" });
	}
};
