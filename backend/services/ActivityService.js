import Activity from "../models/Activity.js";
import ipLocationService from "./ipLocationService.js";

/**
 * Log DocuSign activity with IP tracking and geolocation
 * @param {string} userId - User ID performing the action
 * @param {string} type - Activity type (e.g., 'DOCUSIGN_TEMPLATE_CREATED')
 * @param {string} message - Human-readable message
 * @param {Object} details - Additional details about the activity
 * @param {Object} req - Express request object (optional, for IP tracking)
 */
export const logDocuSignActivity = async (userId, type, message, details = {}, req = null) => {
	try {
		const activityData = {
			user: userId,
			type,
			message,
			details: { ...details },
		};

		// Add IP and location if request object is provided
		if (req) {
			const ipAddress = ipLocationService.extractIPAddress(req);
			const userAgent = req.headers["user-agent"];

			activityData.details.ipAddress = ipAddress;
			activityData.details.userAgent = userAgent;
			activityData.details.timestamp = new Date();

			// Try to get location data
			try {
				const location = await ipLocationService.getLocationFromIP(ipAddress);
				if (location) {
					activityData.details.location = {
						country: location.country,
						city: location.city,
						region: location.region,
					};
				}
			} catch (locationError) {
				console.warn("Failed to get location data:", locationError.message);
			}
		}

		await Activity.create(activityData);
	} catch (error) {
		console.error("Error logging DocuSign activity:", error);
		// Don't throw - logging failures shouldn't break the main flow
	}
};

/**
 * Get activities for a specific user
 * @param {string} userId - User ID
 * @param {Object} options - Query options (limit, skip, type filter)
 */
export const getUserActivities = async (userId, options = {}) => {
	const { limit = 50, skip = 0, type } = options;

	const query = { user: userId };
	if (type) {
		query.type = type;
	}

	return await Activity.find(query)
		.sort({ createdAt: -1 })
		.limit(limit)
		.skip(skip)
		.populate("user", "firstName lastName email");
};

/**
 * Get recent DocuSign activities
 * @param {Object} options - Query options
 */
export const getRecentDocuSignActivities = async (options = {}) => {
	const { limit = 50, skip = 0 } = options;

	return await Activity.find({
		type: { $regex: /^DOCUSIGN_/, $options: "i" },
	})
		.sort({ createdAt: -1 })
		.limit(limit)
		.skip(skip)
		.populate("user", "firstName lastName email");
};

export default {
	logDocuSignActivity,
	getUserActivities,
	getRecentDocuSignActivities,
};
