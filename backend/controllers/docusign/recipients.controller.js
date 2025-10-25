import DocuSignTemplate from "../../models/DocuSignTemplate.js";
import { v4 as uuidv4 } from "uuid";

// Add recipients to a template
export const addRecipients = async (req, res) => {
    try {
        const { templateId } = req.params;
        const { recipients } = req.body;

        if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Recipients array is required and cannot be empty",
            });
        }

        const template = await DocuSignTemplate.findById(templateId);
        if (!template) {
            return res.status(404).json({
                success: false,
                message: "Template not found",
            });
        }

        // Check if user owns this template
        if (template.createdBy.toString() !== req.user.id) {
            return res.status(403).json({
                success: false,
                message: "You can only add recipients to your own templates",
            });
        }

        // Validate and prepare recipients
        const newRecipients = recipients.map((recipient, index) => {
            if (!recipient.name || !recipient.email) {
                throw new Error("Each recipient must have a name and email");
            }

            return {
                id: uuidv4(),
                name: recipient.name.trim(),
                email: recipient.email.trim().toLowerCase(),
                userId: recipient.userId || null,
                signatureStatus: "waiting", // Start as waiting, will be updated based on order
                signingOrder: recipient.signingOrder || (template.recipients.length + index + 1),
                notifiedAt: null,
                eligibleAt: null,
            };
        });

        // Add recipients to template
        template.recipients.push(...newRecipients);

        // Update signing status based on order
        await template.updateSigningStatus();

        await template.save();

        res.json({
            success: true,
            message: "Recipients added successfully",
            data: {
                template: template,
                addedRecipients: newRecipients,
            },
        });
    } catch (error) {
        console.error("Error adding recipients:", error);
        res.status(500).json({
            success: false,
            message: error.message || "Failed to add recipients",
        });
    }
};

// Update recipient signing order
export const updateSigningOrder = async (req, res) => {
    try {
        const { templateId } = req.params;
        const { recipients } = req.body;

        if (!recipients || !Array.isArray(recipients)) {
            return res.status(400).json({
                success: false,
                message: "Recipients array with signing order is required",
            });
        }

        const template = await DocuSignTemplate.findById(templateId);
        if (!template) {
            return res.status(404).json({
                success: false,
                message: "Template not found",
            });
        }

        // Check if user owns this template
        if (template.createdBy.toString() !== req.user.id) {
            return res.status(403).json({
                success: false,
                message: "You can only modify your own templates",
            });
        }

        // Update signing order for each recipient
        recipients.forEach(({ id, signingOrder }) => {
            const recipient = template.recipients.find(r => r.id === id);
            if (recipient) {
                recipient.signingOrder = signingOrder;
            }
        });

        // Update signing status based on new order
        await template.updateSigningStatus();

        await template.save();

        res.json({
            success: true,
            message: "Signing order updated successfully",
            data: template,
        });
    } catch (error) {
        console.error("Error updating signing order:", error);
        res.status(500).json({
            success: false,
            message: error.message || "Failed to update signing order",
        });
    }
};

// Remove a recipient
export const removeRecipient = async (req, res) => {
    try {
        const { templateId, recipientId } = req.params;

        const template = await DocuSignTemplate.findById(templateId);
        if (!template) {
            return res.status(404).json({
                success: false,
                message: "Template not found",
            });
        }

        // Check if user owns this template
        if (template.createdBy.toString() !== req.user.id) {
            return res.status(403).json({
                success: false,
                message: "You can only modify your own templates",
            });
        }

        // Find and remove recipient
        const recipientIndex = template.recipients.findIndex(r => r.id === recipientId);
        if (recipientIndex === -1) {
            return res.status(404).json({
                success: false,
                message: "Recipient not found",
            });
        }

        const removedRecipient = template.recipients[recipientIndex];
        template.recipients.splice(recipientIndex, 1);

        // Update signing status for remaining recipients
        await template.updateSigningStatus();

        await template.save();

        res.json({
            success: true,
            message: "Recipient removed successfully",
            data: {
                template: template,
                removedRecipient: removedRecipient,
            },
        });
    } catch (error) {
        console.error("Error removing recipient:", error);
        res.status(500).json({
            success: false,
            message: error.message || "Failed to remove recipient",
        });
    }
};

// Get signing progress for a template
export const getSigningProgress = async (req, res) => {
    try {
        const { templateId } = req.params;

        const template = await DocuSignTemplate.findById(templateId);
        if (!template) {
            return res.status(404).json({
                success: false,
                message: "Template not found",
            });
        }

        // Calculate progress
        const totalRecipients = template.recipients.length;
        const signedRecipients = template.recipients.filter(r => r.signatureStatus === "signed").length;
        const nextRecipient = template.getNextRecipientToSign();

        const progress = {
            totalRecipients,
            signedRecipients,
            completionPercentage: totalRecipients > 0 ? Math.round((signedRecipients / totalRecipients) * 100) : 0,
            nextRecipient: nextRecipient ? {
                id: nextRecipient.id,
                name: nextRecipient.name,
                email: nextRecipient.email,
                signingOrder: nextRecipient.signingOrder,
            } : null,
            recipients: template.recipients.sort((a, b) => a.signingOrder - b.signingOrder),
            isComplete: signedRecipients === totalRecipients,
        };

        res.json({
            success: true,
            data: progress,
        });
    } catch (error) {
        console.error("Error getting signing progress:", error);
        res.status(500).json({
            success: false,
            message: error.message || "Failed to get signing progress",
        });
    }
};

// Check if a recipient can sign (based on signing order)
export const checkSigningEligibility = async (req, res) => {
    try {
        const { templateId } = req.params;
        const { recipientEmail } = req.query;

        if (!recipientEmail) {
            return res.status(400).json({
                success: false,
                message: "Recipient email is required",
            });
        }

        const template = await DocuSignTemplate.findById(templateId);
        if (!template) {
            return res.status(404).json({
                success: false,
                message: "Template not found",
            });
        }

        const canSign = template.canRecipientSign(recipientEmail);
        const recipient = template.recipients.find(r => r.email === recipientEmail);
        const nextRecipient = template.getNextRecipientToSign();

        res.json({
            success: true,
            data: {
                canSign,
                recipient: recipient ? {
                    id: recipient.id,
                    name: recipient.name,
                    email: recipient.email,
                    signatureStatus: recipient.signatureStatus,
                    signingOrder: recipient.signingOrder,
                    signedAt: recipient.signedAt,
                } : null,
                nextRecipient: nextRecipient ? {
                    id: nextRecipient.id,
                    name: nextRecipient.name,
                    email: nextRecipient.email,
                    signingOrder: nextRecipient.signingOrder,
                } : null,
                message: canSign
                    ? "You can sign this document now"
                    : recipient
                        ? `Please wait for ${nextRecipient?.name || 'the previous signer'} to sign first`
                        : "You are not a recipient of this document",
            },
        });
    } catch (error) {
        console.error("Error checking signing eligibility:", error);
        res.status(500).json({
            success: false,
            message: error.message || "Failed to check signing eligibility",
        });
    }
};