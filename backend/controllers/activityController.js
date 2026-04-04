import Activity from "../models/Activity.js";

// Get recent activities for the authenticated user
export const getRecentActivities = async (request, reply) => {
  try {
    const userId = request.user.id;

    const activities = await Activity.find({ user: userId })
      .sort({ createdAt: -1 })
      .limit(10)
      .populate("user", "firstName lastName email");

    return { success: true, data: activities };
  } catch (error) {
    request.log.error("Error fetching recent activities:", error);
    return reply.status(500).send({
      success: false,
      message: "Failed to fetch recent activities",
      error: error.message,
    });
  }
};

// Get DocuSign activities with filtering and pagination
export const getDocuSignActivities = async (request, reply) => {
  try {
    const userId = request.user.id;
    const { page = 1, limit = 20, type, search } = request.query;

    const query = { 
      user: userId,
      type: { $regex: /^DOCUSIGN_/, $options: "i" }
    };

    if (type && type !== "all") {
      query.type = type;
    }

    if (search) {
      query.$or = [
        { message: { $regex: search, $options: "i" } },
        { "details.templateName": { $regex: search, $options: "i" } },
        { "details.name": { $regex: search, $options: "i" } }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await Activity.countDocuments(query);

    const activities = await Activity.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate("user", "firstName lastName email");

    return {
      success: true,
      data: activities,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
        total,
        limit: parseInt(limit),
      },
    };
  } catch (error) {
    request.log.error("Error fetching DocuSign activities:", error);
    return reply.status(500).send({
      success: false,
      message: "Failed to fetch DocuSign activities",
      error: error.message,
    });
  }
};

