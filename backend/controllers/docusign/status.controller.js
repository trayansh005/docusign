import DocuSignTemplate from "../../models/DocuSignTemplate.js";
import Activity from "../../models/Activity.js";
import { logDocuSignActivity } from "../../services/ActivityService.js";
import { TemplateValidator } from "../../validators/TemplateValidator.js";

/**
 * Update template status
 */
export const updateTemplateStatus = async (request, reply) => {
  try {
    const { templateId } = request.params;
    const { status } = request.body;

    if (!TemplateValidator.isValidObjectId(templateId)) {
      return reply.status(400).send({
        success: false,
        message: "Invalid template ID",
      });
    }

    const template = await DocuSignTemplate.findById(templateId);
    if (!template) {
      return reply.status(404).send({
        success: false,
        message: "Template not found",
      });
    }

    if (!TemplateValidator.isValidStatusTransition(template.status, status)) {
      return reply.status(400).send({
        success: false,
        message: `Cannot transition from ${template.status} to ${status}`,
      });
    }

    const oldStatus = template.status;
    template.status = status;
    template.updatedBy = request.user?.id;
    await template.save();

    await logDocuSignActivity(
      request.user?.id,
      "DOCUSIGN_STATUS_UPDATED",
      `Status changed from ${oldStatus} to ${status} for template: ${template.name}`,
      {
        templateId: template._id,
        oldStatus,
        newStatus: status,
      },
      request
    );

    return {
      success: true,
      data: template,
      message: "Status updated successfully",
    };
  } catch (error) {
    request.log.error("Update template status error:", error);
    return reply.status(500).send({
      success: false,
      message: error.message || "Failed to update status",
    });
  }
};

/**
 * Get template status history from activity logs
 */
export const getTemplateStatusHistory = async (request, reply) => {
  try {
    const { templateId } = request.params;

    if (!TemplateValidator.isValidObjectId(templateId)) {
      return reply.status(400).send({
        success: false,
        message: "Invalid template ID",
      });
    }

    const template = await DocuSignTemplate.findById(templateId);
    if (!template) {
      return reply.status(404).send({
        success: false,
        message: "Template not found",
      });
    }

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

    return {
      success: true,
      data: {
        currentStatus: template.status,
        history: activities,
      },
    };
  } catch (error) {
    request.log.error("Get template status history error:", error);
    return reply.status(500).send({
      success: false,
      message: error.message || "Failed to get status history",
    });
  }
};

/**
 * Get templates filtered by status
 */
export const getTemplatesByStatus = async (request, reply) => {
  try {
    const { status, page = 1, limit = 10 } = request.query;
    const userId = request.user.id;

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

    return {
      success: true,
      data: templates,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limitNum),
        total,
        limit: limitNum,
      },
    };
  } catch (error) {
    request.log.error("Get templates by status error:", error);
    return reply.status(500).send({
      success: false,
      message: error.message || "Failed to get templates",
    });
  }
};

/**
 * Get status statistics
 */
export const getStatusStatistics = async (request, reply) => {
  try {
    const userId = request.user.id;

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

    return {
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
    };
  } catch (error) {
    request.log.error("Get status statistics error:", error);
    return reply.status(500).send({
      success: false,
      message: error.message || "Failed to get statistics",
    });
  }
};

/**
 * Get signature tracking data
 */
export const getSignatureTracking = async (request, reply) => {
  try {
    const { templateId } = request.params;

    if (!TemplateValidator.isValidObjectId(templateId)) {
      return reply.status(400).send({
        success: false,
        message: "Invalid template ID",
      });
    }

    const template = await DocuSignTemplate.findById(templateId);
    if (!template) {
      return reply.status(404).send({
        success: false,
        message: "Template not found",
      });
    }

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

    return {
      success: true,
      data: {
        template: {
          id: template._id,
          name: template.name,
          status: template.status,
        },
        events: trackingEvents,
      },
    };
  } catch (error) {
    request.log.error("Get signature tracking error:", error);
    return reply.status(500).send({
      success: false,
      message: error.message || "Failed to get tracking data",
    });
  }
};

