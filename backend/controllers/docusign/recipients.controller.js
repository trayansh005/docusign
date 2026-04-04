import DocuSignTemplate from "../../models/DocuSignTemplate.js";
import { v4 as uuidv4 } from "uuid";

// Add recipients to a template
export const addRecipients = async (request, reply) => {
  try {
    const { templateId } = request.params;
    const { recipients } = request.body;

    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return reply.status(400).send({
        success: false,
        message: "Recipients array is required and cannot be empty",
      });
    }

    const template = await DocuSignTemplate.findById(templateId);
    if (!template) {
      return reply.status(404).send({
        success: false,
        message: "Template not found",
      });
    }

    if (template.createdBy.toString() !== request.user.id) {
      return reply.status(403).send({
        success: false,
        message: "You can only add recipients to your own templates",
      });
    }

    const newRecipients = recipients.map((recipient, index) => {
      if (!recipient.name || !recipient.email) {
        throw new Error("Each recipient must have a name and email");
      }

      return {
        id: uuidv4(),
        name: recipient.name.trim(),
        email: recipient.email.trim().toLowerCase(),
        userId: recipient.userId || null,
        signatureStatus: "waiting",
        signingOrder: recipient.signingOrder || (template.recipients.length + index + 1),
        notifiedAt: null,
        eligibleAt: null,
      };
    });

    template.recipients.push(...newRecipients);
    await template.updateSigningStatus();
    await template.save();

    return {
      success: true,
      message: "Recipients added successfully",
      data: {
        template: template,
        addedRecipients: newRecipients,
      },
    };
  } catch (error) {
    request.log.error("Error adding recipients:", error);
    return reply.status(500).send({
      success: false,
      message: error.message || "Failed to add recipients",
    });
  }
};

// Update recipient signing order
export const updateSigningOrder = async (request, reply) => {
  try {
    const { templateId } = request.params;
    const { recipients } = request.body;

    if (!recipients || !Array.isArray(recipients)) {
      return reply.status(400).send({
        success: false,
        message: "Recipients array with signing order is required",
      });
    }

    const template = await DocuSignTemplate.findById(templateId);
    if (!template) {
      return reply.status(404).send({
        success: false,
        message: "Template not found",
      });
    }

    if (template.createdBy.toString() !== request.user.id) {
      return reply.status(403).send({
        success: false,
        message: "You can only modify your own templates",
      });
    }

    recipients.forEach(({ id, signingOrder }) => {
      const recipient = template.recipients.find(r => r.id === id);
      if (recipient) {
        recipient.signingOrder = signingOrder;
      }
    });

    await template.updateSigningStatus();
    await template.save();

    return {
      success: true,
      message: "Signing order updated successfully",
      data: template,
    };
  } catch (error) {
    request.log.error("Error updating signing order:", error);
    return reply.status(500).send({
      success: false,
      message: error.message || "Failed to update signing order",
    });
  }
};

// Remove a recipient
export const removeRecipient = async (request, reply) => {
  try {
    const { templateId, recipientId } = request.params;

    const template = await DocuSignTemplate.findById(templateId);
    if (!template) {
      return reply.status(404).send({
        success: false,
        message: "Template not found",
      });
    }

    if (template.createdBy.toString() !== request.user.id) {
      return reply.status(403).send({
        success: false,
        message: "You can only modify your own templates",
      });
    }

    const recipientIndex = template.recipients.findIndex(r => r.id === recipientId);
    if (recipientIndex === -1) {
      return reply.status(404).send({
        success: false,
        message: "Recipient not found",
      });
    }

    const removedRecipient = template.recipients[recipientIndex];
    template.recipients.splice(recipientIndex, 1);

    await template.updateSigningStatus();
    await template.save();

    return {
      success: true,
      message: "Recipient removed successfully",
      data: {
        template: template,
        removedRecipient: removedRecipient,
      },
    };
  } catch (error) {
    request.log.error("Error removing recipient:", error);
    return reply.status(500).send({
      success: false,
      message: error.message || "Failed to remove recipient",
    });
  }
};

// Get signing progress for a template
export const getSigningProgress = async (request, reply) => {
  try {
    const { templateId } = request.params;

    const template = await DocuSignTemplate.findById(templateId);
    if (!template) {
      return reply.status(404).send({
        success: false,
        message: "Template not found",
      });
    }

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

    return {
      success: true,
      data: progress,
    };
  } catch (error) {
    request.log.error("Error getting signing progress:", error);
    return reply.status(500).send({
      success: false,
      message: error.message || "Failed to get signing progress",
    });
  }
};

// Check if a recipient can sign (based on signing order)
export const checkSigningEligibility = async (request, reply) => {
  try {
    const { templateId } = request.params;
    const { recipientEmail } = request.query;

    if (!recipientEmail) {
      return reply.status(400).send({
        success: false,
        message: "Recipient email is required",
      });
    }

    const template = await DocuSignTemplate.findById(templateId);
    if (!template) {
      return reply.status(404).send({
        success: false,
        message: "Template not found",
      });
    }

    const canSign = template.canRecipientSign(recipientEmail);
    const recipient = template.recipients.find(r => r.email === recipientEmail);
    const nextRecipient = template.getNextRecipientToSign();

    return {
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
    };
  } catch (error) {
    request.log.error("Error checking signing eligibility:", error);
    return reply.status(500).send({
      success: false,
      message: error.message || "Failed to check signing eligibility",
    });
  }
};