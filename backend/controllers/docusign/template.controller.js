import DocuSignTemplate from "../../models/DocuSignTemplate.js";
import DocuSignDocument from "../../models/DocuSignDocument.js";
import { logDocuSignActivity } from "../../services/ActivityService.js";
import { TemplateValidator } from "../../validators/TemplateValidator.js";

/**
 * Get list of templates with optimized queries
 */
export const listTemplates = async (req, res) => {
	try {
		const { page = 1, limit = 10, status, type, createdBy, search } = req.query;
		const userId = req.user.id;

		// Build optimized query
		const query = TemplateValidator.buildListQuery({
			status,
			type,
			createdBy: userId,
			search,
		});

		// Optimize pagination
		const skip = (parseInt(page) - 1) * parseInt(limit);
		const limitNum = parseInt(limit);

		// Use lean() for better performance and only select needed fields
		const [templates, total] = await Promise.all([
			DocuSignTemplate.find(query)
				.select(
					"name type status numPages metadata.filename metadata.fileSize metadata.originalPdfPath metadata.fileHash metadata.document createdAt updatedAt signatureFields finalPdfUrl"
				)
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
		console.error("List templates error:", error);
		return res.status(500).json({
			success: false,
			message: error.message || "Failed to list templates",
		});
	}
};

/**
 * Get specific template by ID
 */
export const getTemplate = async (req, res) => {
	try {
		const { templateId } = req.params;

		if (!TemplateValidator.isValidObjectId(templateId)) {
			return res.status(400).json({
				success: false,
				message: "Invalid template ID",
			});
		}

		const template = await DocuSignTemplate.findOne({
			$or: [{ _id: templateId }, { "metadata.fileId": templateId }],
			isArchived: false,
		}).populate("createdBy", "firstName lastName email");

		if (!template) {
			return res.status(404).json({
				success: false,
				message: "Template not found",
			});
		}

		return res.status(200).json({
			success: true,
			data: template.toObject(),
		});
	} catch (error) {
		console.error("Get template error:", error);
		return res.status(500).json({
			success: false,
			message: error.message || "Failed to get template",
		});
	}
};

/**
 * Update template metadata
 */
export const updateTemplate = async (req, res) => {
	try {
		const { templateId } = req.params;
		const { name, type, tags } = req.body;

		if (!TemplateValidator.isValidObjectId(templateId)) {
			return res.status(400).json({
				success: false,
				message: "Invalid template ID",
			});
		}

		const template = await DocuSignTemplate.findOne({
			$or: [{ _id: templateId }, { "metadata.fileId": templateId }],
			isArchived: false,
		});

		if (!template) {
			return res.status(404).json({
				success: false,
				message: "Template not found",
			});
		}

		// Update allowed fields
		if (name) template.name = name;
		if (type) template.type = type;
		if (tags) template.tags = tags;

		template.updatedBy = req.user?.id;
		await template.save();

		// Log activity
		await logDocuSignActivity(
			req.user?.id,
			"DOCUSIGN_TEMPLATE_UPDATED",
			`Updated DocuSign template: ${template.name}`,
			{ templateId: template._id, name: template.name },
			req
		);

		return res.status(200).json({
			success: true,
			data: template.toObject(),
			message: "Template updated successfully",
		});
	} catch (error) {
		console.error("Update template error:", error);
		return res.status(500).json({
			success: false,
			message: error.message || "Failed to update template",
		});
	}
};

/**
 * Delete template (archive)
 */
export const deleteTemplate = async (req, res) => {
	try {
		const { templateId } = req.params;

		if (!TemplateValidator.isValidObjectId(templateId)) {
			return res.status(400).json({
				success: false,
				message: "Invalid template ID",
			});
		}

		const template = await DocuSignTemplate.findOne({
			$or: [{ _id: templateId }, { "metadata.fileId": templateId }],
			isArchived: false,
		});

		if (!template) {
			return res.status(404).json({
				success: false,
				message: "Template not found",
			});
		}

		// Archive instead of hard delete
		template.isArchived = true;
		template.updatedBy = req.user?.id;
		await template.save();

		// Log activity
		await logDocuSignActivity(
			req.user?.id,
			"DOCUSIGN_TEMPLATE_DELETED",
			`Deleted DocuSign template: ${template.name}`,
			{ templateId: template._id, name: template.name },
			req
		);

		return res.status(200).json({
			success: true,
			message: "Template archived successfully",
		});
	} catch (error) {
		console.error("Delete template error:", error);
		return res.status(500).json({
			success: false,
			message: error.message || "Failed to delete template",
		});
	}
};
