import DocuSignTemplate from "../../models/DocuSignTemplate.js";

/**
 * Migration to add signingOrder to existing recipients
 */
export const migrateSigningOrder = async (request, reply) => {
  try {
    request.log.info("Starting signing order migration...");

    const templates = await DocuSignTemplate.find({
      "recipients.0": { $exists: true },
      $or: [
        { "recipients.signingOrder": { $exists: false } },
        { "recipients.signingOrder": null },
        { "recipients.signingOrder": undefined },
      ]
    });

    request.log.info(`Found ${templates.length} templates to migrate`);

    let migratedCount = 0;
    let errorCount = 0;

    for (const template of templates) {
      try {
        let needsUpdate = false;
        template.recipients = template.recipients.map((recipient, index) => {
          if (!recipient.signingOrder) {
            needsUpdate = true;
            return {
              ...recipient,
              signingOrder: index + 1,
              signatureStatus: recipient.signatureStatus || (index === 0 ? "pending" : "waiting"),
              eligibleAt: index === 0 ? new Date() : null,
            };
          }
          return recipient;
        });

        if (needsUpdate) {
          await template.updateSigningStatus();
          await template.save();
          migratedCount++;
        }
      } catch (error) {
        request.log.error(`Error migrating template ${template._id}:`, error);
        errorCount++;
      }
    }

    return {
      success: true,
      message: "Signing order migration completed",
      data: {
        totalFound: templates.length,
        migrated: migratedCount,
        errors: errorCount,
      },
    };
  } catch (error) {
    request.log.error("Migration error:", error);
    return reply.status(500).send({
      success: false,
      message: "Migration failed",
      error: error.message,
    });
  }
};

/**
 * Fix a specific template's signing order
 */
export const fixTemplateSigningOrder = async (request, reply) => {
  try {
    const { templateId } = request.params;
    const template = await DocuSignTemplate.findById(templateId);
    if (!template) return reply.status(404).send({ success: false, message: "Template not found" });

    if (template.createdBy.toString() !== request.user.id) {
      return reply.status(403).send({ success: false, message: "Not authorized" });
    }

    let needsUpdate = false;
    template.recipients = template.recipients.map((recipient, index) => {
      if (!recipient.signingOrder) {
        needsUpdate = true;
        return {
          ...recipient,
          signingOrder: index + 1,
          signatureStatus: recipient.signatureStatus || (index === 0 ? "pending" : "waiting"),
          eligibleAt: index === 0 ? new Date() : null,
        };
      }
      return recipient;
    });

    if (needsUpdate) {
      await template.updateSigningStatus();
      await template.save();
    }

    return {
      success: true,
      message: needsUpdate ? "Template signing order fixed" : "Already correct",
      data: template,
    };
  } catch (error) {
    request.log.error("Error fixing order:", error);
    return reply.status(500).send({ success: false, message: "Failed", error: error.message });
  }
};