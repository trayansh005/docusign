import DocuSignTemplate from "../../models/DocuSignTemplate.js";
import Activity from "../../models/Activity.js";
import { logDocuSignActivity } from "../../services/ActivityService.js";
import { TemplateValidator } from "../../validators/TemplateValidator.js";

/**
 * Update template status
 */
export const updateTemplateStatus = async (req, res) => {
	try {
		const { templateId } = req.params;
		const { status } = req.body;

		if (!TemplateValidator.isValidObjectId(templateId)) {
			return res.status(400).json({
				success: false,
				message: "Invalid template ID",
			});
		}

		const template = await DocuSignTemplate.findById(templateId);
		if (!template) {
			return res.status(404).json({
				success: false,
				message: "Template not found",
			});
		}

		// Validate status transition
		if (!TemplateValidator.isValidStatusTransition(template.status, status)) {
			return res.status(400).json({
				success: false,
				message: `Cannot transition from ${template.status} to ${status}`,
			});
		}

		const oldStatus = template.status;
		template.status = status;
		template.updatedBy = req.user?.id;
		await template.save();

		// Log activity
		await logDocuSignActivity(
			req.user?.id,
			"DOCUSIGN_STATUS_UPDATED",
			`Status changed from ${oldStatus} to ${status} for template: ${template.name}`,
			{
				templateId: template._id,
				oldStatus,
				newStatus: status,
			},
			req
		);

		return res.status(200).json({
			success: true,
			data: template,
			message: "Status updated successfully",
		});
	} catch (error) {
		console.error("Update template status error:", error);
		return res.status(500).json({
			success: false,
			message: error.message || "Failed to update status",
		});
	}
};

/**
 * Get template status history from activity logs
 */
export const getTemplateStatusHistory = async (req, res) => {
	try {
		const { templateId } = req.params;

		if (!TemplateValidator.isValidObjectId(templateId)) {
			return res.status(400).json({
				success: false,
				message: "Invalid template ID",
			});
		}

		const template = await DocuSignTemplate.findById(templateId);
		if (!template) {
			return res.status(404).json({
				success: false,
				message: "Template not found",
			});
		}

		// Get status-related activities
		const activities = await Activity.find({
			$or: [
				{ "details.templateId": templateId },
				{ "details.templateId": templateId.toString() },
			],
			type: {
				$in: [
					"DOCUSIGN_TEMPLATE_CREATED",
					"DOCUSIGN_STATUS_UPDATED",
					"DOCUSIGN_TEMPLATE_SIGNED",
					"DOCUSIGN_TEMPLATE_DELETED",
				],
			},
		})
			.sort({ createdAt: 1 })
			.populate("user", "firstName lastName email")
			.lean();

		return res.status(200).json({
			success: true,
			data: {
				currentStatus: template.status,
				history: activities,
			},
		});
	} catch (error) {
		console.error("Get template status history error:", error);
		return res.status(500).json({
			success: false,
			message: error.message || "Failed to get status history",
		});
	}
};

/**
 * Get templates filtered by status
 */
export const getTemplatesByStatus = async (req, res) => {
	try {
		const { status, page = 1, limit = 10 } = req.query;
		const userId = req.user.id;

		const query = {
			isArchived: false,
			createdBy: userId,
		};

		if (status) {
			query.status = status;
		}

		const skip = (parseInt(page) - 1) * parseInt(limit);
		const limitNum = parseInt(limit);

		const [templates, total] = await Promise.all([
			DocuSignTemplate.find(query)
				.select("name type status numPages metadata createdAt updatedAt finalPdfUrl")
				.populate("createdBy", "firstName lastName email")
				.sort({ createdAt: -1 })
				.skip(skip)
				.limit(limitNum)
				.lean(),
			DocuSignTemplate.countDocuments(query),
		]);

		return res.status(200).json({
			success: true,
			data: templates,
			pagination: {
				current: parseInt(page),
				pages: Math.ceil(total / limitNum),
				total,
				limit: limitNum,
			},
		});
	} catch (error) {
		console.error("Get templates by status error:", error);
		return res.status(500).json({
			success: false,
			message: error.message || "Failed to get templates",
		});
	}
};

/**
 * Get status statistics
 */
export const getStatusStatistics = async (req, res) => {
	try {
		const userId = req.user.id;

		const stats = await DocuSignTemplate.aggregate([
			{
				$match: {
					createdBy: userId,
					isArchived: false,
				},
			},
			{
				$group: {
					_id: "$status",
					count: { $sum: 1 },
				},
			},
		]);

		const statsObject = {};
		stats.forEach((stat) => {
			statsObject[stat._id] = stat.count;
		});

		return res.status(200).json({
			success: true,
			data: {
				draft: statsObject.draft || 0,
				active: statsObject.active || 0,
				final: statsObject.final || 0,
				processing: statsObject.processing || 0,
				failed: statsObject.failed || 0,
				archived: statsObject.archived || 0,
				total: Object.values(statsObject).reduce((sum, count) => sum + count, 0),
			},
		});
	} catch (error) {
		console.error("Get status statistics error:", error);
		return res.status(500).json({
			success: false,
			message: error.message || "Failed to get statistics",
		});
	}
};

/**
 * Get signature tracking data
 */
export const getSignatureTracking = async (req, res) => {
	try {
		const { templateId } = req.params;

		if (!TemplateValidator.isValidObjectId(templateId)) {
			return res.status(400).json({
				success: false,
				message: "Invalid template ID",
			});
		}

		const template = await DocuSignTemplate.findById(templateId);
		if (!template) {
			return res.status(404).json({
				success: false,
				message: "Template not found",
			});
		}

		// Get signature-related activities
		const activities = await Activity.find({
			$or: [
				{ "details.templateId": templateId },
				{ "details.templateId": templateId.toString() },
			],
			type: {
				$in: [
					"DOCUSIGN_TEMPLATE_SIGNED",
					"DOCUSIGN_DOCUMENT_VIEWED",
					"DOCUSIGN_DOCUMENT_SIGNED",
				],
			},
		})
			.sort({ createdAt: -1 })
			.populate("user", "firstName lastName email")
			.lean();

		// Format activities as tracking events
		const trackingEvents = activities.map((activity) => ({
			_id: activity._id,
			eventType: activity.type.includes("SIGNED") ? "signed" : "viewed",
			user: activity.user,
			ipAddress: activity.details?.ipAddress,
			location: activity.details?.location,
			userAgent: activity.details?.userAgent,
			timestamp: activity.createdAt,
			message: activity.message,
		}));

		return res.status(200).json({
			success: true,
			data: {
				template: {
					id: template._id,
					name: template.name,
					status: template.status,
				},
				events: trackingEvents,
			},
		});
	} catch (error) {
		console.error("Get signature tracking error:", error);
		return res.status(500).json({
			success: false,
			message: error.message || "Failed to get tracking data",
		});
	}
};
