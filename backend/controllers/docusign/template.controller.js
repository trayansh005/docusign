import DocuSignTemplate from "../../models/DocuSignTemplate.js";
import { logDocuSignActivity } from "../../services/ActivityService.js";
import { TemplateValidator } from "../../validators/TemplateValidator.js";

/**
 * Get list of templates with optimized queries
 */
export const listTemplates = async (request, reply) => {
  try {
    const { page = 1, limit = 10, status, type, search } = request.query;
    const userId = request.user.id;

    // Build optimized query
    const query = TemplateValidator.buildListQuery({
      status,
      type,
      createdBy: userId,
      search,
    });

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const limitNum = parseInt(limit);

    const [templates, total] = await Promise.all([
      DocuSignTemplate.find(query)
        .select(
          "name type status numPages metadata.filename metadata.fileSize metadata.originalPdfPath metadata.fileHash metadata.document createdAt updatedAt signatureFields finalPdfUrl recipients"
        )
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
    request.log.error("List templates error:", error);
    return reply.status(500).send({
      success: false,
      message: error.message || "Failed to list templates",
    });
  }
};

/**
 * Get specific template by ID
 */
export const getTemplate = async (request, reply) => {
  try {
    const { templateId } = request.params;

    if (!TemplateValidator.isValidObjectId(templateId)) {
      return reply.status(400).send({
        success: false,
        message: "Invalid template ID",
      });
    }

    const template = await DocuSignTemplate.findOne({
      $or: [{ _id: templateId }, { "metadata.fileId": templateId }],
      isArchived: false,
    }).populate("createdBy", "firstName lastName email");

    if (!template) {
      return reply.status(404).send({
        success: false,
        message: "Template not found",
      });
    }

    return {
      success: true,
      data: template.toObject(),
    };
  } catch (error) {
    request.log.error("Get template error:", error);
    return reply.status(500).send({
      success: false,
      message: error.message || "Failed to get template",
    });
  }
};

/**
 * Update template metadata
 */
export const updateTemplate = async (request, reply) => {
  try {
    const { templateId } = request.params;
    const { name, type, tags } = request.body;

    if (!TemplateValidator.isValidObjectId(templateId)) {
      return reply.status(400).send({
        success: false,
        message: "Invalid template ID",
      });
    }

    const template = await DocuSignTemplate.findOne({
      $or: [{ _id: templateId }, { "metadata.fileId": templateId }],
      isArchived: false,
    });

    if (!template) {
      return reply.status(404).send({
        success: false,
        message: "Template not found",
      });
    }

    if (name) template.name = name;
    if (type) template.type = type;
    if (tags) template.tags = tags;

    template.updatedBy = request.user?.id;
    await template.save();

    await logDocuSignActivity(
      request.user?.id,
      "DOCUSIGN_TEMPLATE_UPDATED",
      `Updated DocuSign template: ${template.name}`,
      { templateId: template._id, name: template.name },
      request
    );

    return {
      success: true,
      data: template.toObject(),
      message: "Template updated successfully",
    };
  } catch (error) {
    request.log.error("Update template error:", error);
    return reply.status(500).send({
      success: false,
      message: error.message || "Failed to update template",
    });
  }
};

/**
 * Delete template (archive)
 */
export const deleteTemplate = async (request, reply) => {
  try {
    const { templateId } = request.params;

    if (!TemplateValidator.isValidObjectId(templateId)) {
      return reply.status(400).send({
        success: false,
        message: "Invalid template ID",
      });
    }

    const template = await DocuSignTemplate.findOne({
      $or: [{ _id: templateId }, { "metadata.fileId": templateId }],
      isArchived: false,
    });

    if (!template) {
      return reply.status(404).send({
        success: false,
        message: "Template not found",
      });
    }

    template.isArchived = true;
    template.updatedBy = request.user?.id;
    await template.save();

    await logDocuSignActivity(
      request.user?.id,
      "DOCUSIGN_TEMPLATE_DELETED",
      `Deleted DocuSign template: ${template.name}`,
      { templateId: template._id, name: template.name },
      request
    );

    return {
      success: true,
      message: "Template archived successfully",
    };
  } catch (error) {
    request.log.error("Delete template error:", error);
    return reply.status(500).send({
      success: false,
      message: error.message || "Failed to delete template",
    });
  }
};

