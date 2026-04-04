import DocuSignTemplate from "../../models/DocuSignTemplate.js";
import { logDocuSignActivity } from "../../services/ActivityService.js";
import { TemplateValidator } from "../../validators/TemplateValidator.js";
import { FieldValidator } from "../../validators/FieldValidator.js";

/**
 * Update signature fields for a specific page
 */
export const updateTemplatePageFields = async (request, reply) => {
  try {
    const { templateId, pageNumber } = request.params;
    const { signatureFields, viewport } = request.body;

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

    const pageNum = parseInt(pageNumber);
    if (isNaN(pageNum) || pageNum < 1) {
      return reply.status(400).send({
        success: false,
        message: "Invalid page number",
      });
    }

    const processedFields = FieldValidator.processBulkFields(
      signatureFields,
      viewport,
      template.metadata?.pages
    );

    template.signatureFields = template.signatureFields.filter(
      (f) => f.pageNumber !== pageNum
    );
    template.signatureFields.push(...processedFields);

    template.updatedBy = request.user?.id;
    await template.save();

    await logDocuSignActivity(
      request.user?.id,
      "DOCUSIGN_FIELDS_UPDATED",
      `Updated signature fields on page ${pageNum} of template: ${template.name}`,
      {
        templateId: template._id,
        pageNumber: pageNum,
        fieldCount: processedFields.length,
      },
      request
    );

    return {
      success: true,
      data: template.signatureFields,
      message: "Fields updated successfully",
    };
  } catch (error) {
    request.log.error("Update template page fields error:", error);
    return reply.status(500).send({
      success: false,
      message: error.message || "Failed to update fields",
    });
  }
};

/**
 * Bulk update all template fields
 */
export const updateTemplateFields = async (request, reply) => {
  try {
    const { templateId } = request.params;
    const { fields } = request.body;

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

    const validation = FieldValidator.validateBulkFields(fields);
    if (!validation.isValid) {
      return reply.status(400).send({
        success: false,
        message: "Invalid fields",
        errors: validation.errors,
      });
    }

    template.signatureFields = fields;
    template.updatedBy = request.user?.id;
    await template.save();

    await logDocuSignActivity(
      request.user?.id,
      "DOCUSIGN_FIELDS_UPDATED",
      `Bulk updated signature fields for template: ${template.name}`,
      {
        templateId: template._id,
        fieldCount: fields.length,
      },
      request
    );

    return {
      success: true,
      data: template.signatureFields,
      message: "Fields updated successfully",
    };
  } catch (error) {
    request.log.error("Update template fields error:", error);
    return reply.status(500).send({
      success: false,
      message: error.message || "Failed to update fields",
    });
  }
};

/**
 * Get template fields
 */
export const getTemplateFields = async (request, reply) => {
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

    return {
      success: true,
      data: template.signatureFields || [],
    };
  } catch (error) {
    request.log.error("Get template fields error:", error);
    return reply.status(500).send({
      success: false,
      message: error.message || "Failed to get fields",
    });
  }
};

/**
 * Delete a specific signature field
 */
export const deleteSignatureField = async (request, reply) => {
  try {
    const { templateId, fieldId } = request.params;

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

    const initialCount = template.signatureFields.length;
    template.signatureFields = template.signatureFields.filter((f) => f.id !== fieldId);

    if (template.signatureFields.length === initialCount) {
      return reply.status(404).send({
        success: false,
        message: "Field not found",
      });
    }

    template.updatedBy = request.user?.id;
    await template.save();

    await logDocuSignActivity(
      request.user?.id,
      "DOCUSIGN_FIELD_DELETED",
      `Deleted signature field from template: ${template.name}`,
      {
        templateId: template._id,
        fieldId,
      },
      request
    );

    return {
      success: true,
      message: "Field deleted successfully",
    };
  } catch (error) {
    request.log.error("Delete signature field error:", error);
    return reply.status(500).send({
      success: false,
      message: error.message || "Failed to delete field",
    });
  }
};

