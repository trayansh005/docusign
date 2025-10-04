import Activity from "../models/Activity.js";

// Get recent activities for the authenticated user
export const getRecentActivities = async (req, res) => {
	try {
		const userId = req.user.id; // Assuming user is attached by auth middleware

		// Get the 10 most recent activities for the user
		const activities = await Activity.find({ user: userId })
			.sort({ createdAt: -1 })
			.limit(10)
			.populate("user", "firstName lastName email"); // Populate user details if needed

		res.status(200).json({
			success: true,
			data: activities,
		});
	} catch (error) {
		console.error("Error fetching recent activities:", error);
		res.status(500).json({
			success: false,
			message: "Failed to fetch recent activities",
			error: error.message,
		});
	}
};

// Get DocuSign activities with filtering and pagination
export const getDocuSignActivities = async (req, res) => {
	try {
		const userId = req.user.id;
		const { page = 1, limit = 20, type, search } = req.query;

		// Build query for DocuSign activities
		const query = { 
			user: userId,
			type: { $regex: /^DOCUSIGN_/, $options: "i" }
		};

		// Add type filter if specified
		if (type && type !== "all") {
			query.type = type;
		}

		// Add search filter if specified
		if (search) {
			query.$or = [
				{ message: { $regex: search, $options: "i" } },
				{ "details.templateName": { $regex: search, $options: "i" } },
				{ "details.name": { $regex: search, $options: "i" } }
			];
		}

		// Calculate pagination
		const skip = (parseInt(page) - 1) * parseInt(limit);
		const total = await Activity.countDocuments(query);

		// Get activities with pagination
		const activities = await Activity.find(query)
			.sort({ createdAt: -1 })
			.skip(skip)
			.limit(parseInt(limit))
			.populate("user", "firstName lastName email");

		res.status(200).json({
			success: true,
			data: activities,
			pagination: {
				current: parseInt(page),
				pages: Math.ceil(total / parseInt(limit)),
				total,
				limit: parseInt(limit),
			},
		});
	} catch (error) {
		console.error("Error fetching DocuSign activities:", error);
		res.status(500).json({
			success: false,
			message: "Failed to fetch DocuSign activities",
			error: error.message,
		});
	}
};
