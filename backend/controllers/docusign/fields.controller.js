import DocuSignTemplate from "../../models/DocuSignTemplate.js";
import { logDocuSignActivity } from "../../services/ActivityService.js";
import { TemplateValidator } from "../../validators/TemplateValidator.js";
import { FieldValidator } from "../../validators/FieldValidator.js";

/**
 * Update signature fields for a specific page
 */
export const updateTemplatePageFields = async (req, res) => {
	try {
		const { templateId, pageNumber } = req.params;
		const { signatureFields, viewport } = req.body;

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

		const pageNum = parseInt(pageNumber);
		if (isNaN(pageNum) || pageNum < 1) {
			return res.status(400).json({
				success: false,
				message: "Invalid page number",
			});
		}

		// Process and normalize coordinates
		const processedFields = FieldValidator.processBulkFields(
			signatureFields,
			viewport,
			template.metadata?.pages
		);

		// Replace fields for this page
		template.signatureFields = template.signatureFields.filter(
			(f) => f.pageNumber !== pageNum
		);
		template.signatureFields.push(...processedFields);

		template.updatedBy = req.user?.id;
		await template.save();

		// Log activity
		await logDocuSignActivity(
			req.user?.id,
			"DOCUSIGN_FIELDS_UPDATED",
			`Updated signature fields on page ${pageNum} of template: ${template.name}`,
			{
				templateId: template._id,
				pageNumber: pageNum,
				fieldCount: processedFields.length,
			},
			req
		);

		return res.status(200).json({
			success: true,
			data: template.signatureFields,
			message: "Fields updated successfully",
		});
	} catch (error) {
		console.error("Update template page fields error:", error);
		return res.status(500).json({
			success: false,
			message: error.message || "Failed to update fields",
		});
	}
};

/**
 * Bulk update all template fields
 */
export const updateTemplateFields = async (req, res) => {
	try {
		const { templateId } = req.params;
		const { fields } = req.body;

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

		// Validate fields
		const validation = FieldValidator.validateBulkFields(fields);
		if (!validation.isValid) {
			return res.status(400).json({
				success: false,
				message: "Invalid fields",
				errors: validation.errors,
			});
		}

		// Update all fields
		template.signatureFields = fields;
		template.updatedBy = req.user?.id;
		await template.save();

		// Log activity
		await logDocuSignActivity(
			req.user?.id,
			"DOCUSIGN_FIELDS_UPDATED",
			`Bulk updated signature fields for template: ${template.name}`,
			{
				templateId: template._id,
				fieldCount: fields.length,
			},
			req
		);

		return res.status(200).json({
			success: true,
			data: template.signatureFields,
			message: "Fields updated successfully",
		});
	} catch (error) {
		console.error("Update template fields error:", error);
		return res.status(500).json({
			success: false,
			message: error.message || "Failed to update fields",
		});
	}
};

/**
 * Get template fields
 */
export const getTemplateFields = async (req, res) => {
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

		return res.status(200).json({
			success: true,
			data: template.signatureFields || [],
		});
	} catch (error) {
		console.error("Get template fields error:", error);
		return res.status(500).json({
			success: false,
			message: error.message || "Failed to get fields",
		});
	}
};

/**
 * Delete a specific signature field
 */
export const deleteSignatureField = async (req, res) => {
	try {
		const { templateId, fieldId } = req.params;

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

		const initialCount = template.signatureFields.length;
		template.signatureFields = template.signatureFields.filter((f) => f.id !== fieldId);

		if (template.signatureFields.length === initialCount) {
			return res.status(404).json({
				success: false,
				message: "Field not found",
			});
		}

		template.updatedBy = req.user?.id;
		await template.save();

		// Log activity
		await logDocuSignActivity(
			req.user?.id,
			"DOCUSIGN_FIELD_DELETED",
			`Deleted signature field from template: ${template.name}`,
			{
				templateId: template._id,
				fieldId,
			},
			req
		);

		return res.status(200).json({
			success: true,
			message: "Field deleted successfully",
		});
	} catch (error) {
		console.error("Delete signature field error:", error);
		return res.status(500).json({
			success: false,
			message: error.message || "Failed to delete field",
		});
	}
};
