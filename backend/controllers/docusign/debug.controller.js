import DocuSignTemplate from "../../models/DocuSignTemplate.js";

/**
 * Debug endpoint to check recipients data
 */
export const debugRecipients = async (req, res) => {
    try {
        const userId = req.user.id;

        // Get all templates for this user
        const templates = await DocuSignTemplate.find({
            createdBy: userId,
            isArchived: false,
        })
            .select("name recipients signatureFields createdAt")
            .lean();

        const debug = templates.map(template => ({
            id: template._id,
            name: template.name,
            hasRecipients: !!template.recipients,
            recipientsCount: template.recipients?.length || 0,
            recipients: template.recipients || [],
            signatureFieldsCount: template.signatureFields?.length || 0,
            createdAt: template.createdAt,
        }));

        res.json({
            success: true,
            data: {
                totalTemplates: templates.length,
                templatesWithRecipients: templates.filter(t => t.recipients && t.recipients.length > 0).length,
                templates: debug,
            },
        });
    } catch (error) {
        console.error("Debug recipients error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

/**
 * Debug specific template
 */
export const debugTemplate = async (req, res) => {
    try {
        const { templateId } = req.params;

        const template = await DocuSignTemplate.findById(templateId);

        if (!template) {
            return res.status(404).json({
                success: false,
                message: "Template not found",
            });
        }

        res.json({
            success: true,
            data: {
                id: template._id,
                name: template.name,
                hasRecipients: !!template.recipients,
                recipientsCount: template.recipients?.length || 0,
                recipients: template.recipients,
                recipientsRaw: JSON.stringify(template.recipients, null, 2),
                signatureFields: template.signatureFields,
                status: template.status,
                createdAt: template.createdAt,
            },
        });
    } catch (error) {
        console.error("Debug template error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};