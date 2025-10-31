import mongoose from "mongoose";
import DocuSignTemplate from "../models/DocuSignTemplate.js";
import Subscription from "../models/Subscription.js";
import User from "../models/User.js";
import { getFreeTierLimits } from "../utils/freeTierLimits.js";

// GET /api/dashboard/stats
export const getUserStats = async (req, res) => {
	try {
		const userId = req.user?.id || req.user?._id;
		const email = req.user?.email;

		if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

		// Convert userId to ObjectId for MongoDB queries
		const userObjectId = new mongoose.Types.ObjectId(userId);

		// Phase 2 Optimization: Use aggregation pipeline for owner stats (1 query instead of 3)
		const ownerStatsResult = await DocuSignTemplate.aggregate([
			{
				$match: {
					createdBy: userObjectId,
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
			{ "recipients.userId": userObjectId },
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

			// Calculate current month start date
			const now = new Date();
			const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

			// Count total uploads (lifetime, non-archived) - this matches the upload limit check
			const uploadsUsed = await DocuSignTemplate.countDocuments({
				createdBy: userObjectId,
				isArchived: { $ne: true },
			});

			// Count signed documents this month
			const signUsed = await DocuSignTemplate.countDocuments({
				createdBy: userObjectId,
				isArchived: { $ne: true },
				status: "final",
				updatedAt: { $gte: monthStart },
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

// GET /api/dashboard/pending-count
// Get count of pending documents for the user as a recipient
export const getPendingDocumentsCount = async (req, res) => {
	try {
		const userId = req.user?.id || req.user?._id;
		const email = req.user?.email;

		if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

		// Convert userId to ObjectId for MongoDB queries
		const userObjectId = new mongoose.Types.ObjectId(userId);

		// Find templates where the user is a recipient
		const assignedFilter = {
			isArchived: { $ne: true },
			status: { $ne: "final" }, // Only count documents that aren't fully completed
			$or: [
				// Match by signature field recipient ID
				{ "signatureFields.recipientId": String(userId) },
				// Match by recipients array - user ID
				{ "recipients.userId": userObjectId },
				// Match by recipients array - recipient ID string
				{ "recipients.id": String(userId) },
			],
		};

		// Also match by email if available
		if (email) {
			assignedFilter.$or.push({ "recipients.email": email });
		}

		// Get all assigned documents
		const templates = await DocuSignTemplate.find(assignedFilter).select("recipients updatedAt").lean();

		// Filter to only count documents where THIS user hasn't signed yet
		const pendingTemplates = templates.filter((template) => {
			const myRecipient = template.recipients?.find(
				(r) =>
					r.userId?.toString() === userId.toString() ||
					r.id === String(userId) ||
					r.email === email
			);
			// Only count if user's signature status is pending or waiting
			return myRecipient && (myRecipient.signatureStatus === "pending" || myRecipient.signatureStatus === "waiting");
		});

		const pendingCount = pendingTemplates.length;

		// Get user's last notification read time
		const user = await User.findById(userId).select("lastNotificationReadAt").lean();
		const lastReadAt = user?.lastNotificationReadAt;

		// Count unread (documents updated after last read time)
		let unreadCount = pendingCount;
		if (lastReadAt) {
			unreadCount = pendingTemplates.filter((t) => new Date(t.updatedAt) > new Date(lastReadAt)).length;
		}

		return res.status(200).json({
			success: true,
			data: {
				pendingCount,
				unreadCount,
			},
		});
	} catch (error) {
		console.error("getPendingDocumentsCount error", error);
		return res
			.status(500)
			.json({ success: false, message: error.message || "Failed to get pending count" });
	}
};

// POST /api/dashboard/mark-notifications-read
// Mark all notifications as read for the current user
export const markNotificationsRead = async (req, res) => {
	try {
		const userId = req.user?.id || req.user?._id;

		if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

		// Update user's lastNotificationReadAt to current time
		await User.findByIdAndUpdate(userId, {
			lastNotificationReadAt: new Date(),
		});

		return res.status(200).json({
			success: true,
			message: "Notifications marked as read",
		});
	} catch (error) {
		console.error("markNotificationsRead error", error);
		return res
			.status(500)
			.json({ success: false, message: error.message || "Failed to mark notifications as read" });
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

		// Convert userId to ObjectId for MongoDB queries
		const userObjectId = new mongoose.Types.ObjectId(userId);

		// Find templates where the user is a recipient
		const assignedFilter = {
			isArchived: { $ne: true },
			$or: [
				// Match by signature field recipient ID
				{ "signatureFields.recipientId": String(userId) },
				// Match by recipients array - user ID
				{ "recipients.userId": userObjectId },
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
