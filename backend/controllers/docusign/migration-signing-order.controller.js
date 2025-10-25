import DocuSignTemplate from "../../models/DocuSignTemplate.js";

/**
 * Migration to add signingOrder to existing recipients
 * This fixes templates that were created before the signing order feature
 */
export const migrateSigningOrder = async (req, res) => {
    try {
        console.log("Starting signing order migration...");

        // Find all templates with recipients that don't have signingOrder
        const templates = await DocuSignTemplate.find({
            "recipients.0": { $exists: true }, // Has at least one recipient
            $or: [
                { "recipients.signingOrder": { $exists: false } }, // No signingOrder field
                { "recipients.signingOrder": null }, // signingOrder is null
                { "recipients.signingOrder": undefined }, // signingOrder is undefined
            ]
        });

        console.log(`Found ${templates.length} templates to migrate`);

        let migratedCount = 0;
        let errorCount = 0;

        for (const template of templates) {
            try {
                let needsUpdate = false;

                // Update recipients that don't have signingOrder
                template.recipients = template.recipients.map((recipient, index) => {
                    if (!recipient.signingOrder || recipient.signingOrder === null || recipient.signingOrder === undefined) {
                        needsUpdate = true;
                        return {
                            ...recipient,
                            signingOrder: index + 1, // Assign order based on current position
                            signatureStatus: recipient.signatureStatus || (index === 0 ? "pending" : "waiting"),
                            eligibleAt: index === 0 ? new Date() : null,
                        };
                    }
                    return recipient;
                });

                if (needsUpdate) {
                    // Update signing status based on new order
                    await template.updateSigningStatus();
                    await template.save();
                    migratedCount++;
                    console.log(`Migrated template ${template._id}: ${template.name}`);
                }
            } catch (error) {
                console.error(`Error migrating template ${template._id}:`, error);
                errorCount++;
            }
        }

        console.log(`Migration completed: ${migratedCount} templates migrated, ${errorCount} errors`);

        res.json({
            success: true,
            message: "Signing order migration completed",
            data: {
                totalFound: templates.length,
                migrated: migratedCount,
                errors: errorCount,
            },
        });
    } catch (error) {
        console.error("Migration error:", error);
        res.status(500).json({
            success: false,
            message: "Migration failed",
            error: error.message,
        });
    }
};

/**
 * Fix a specific template's signing order
 */
export const fixTemplateSigningOrder = async (req, res) => {
    try {
        const { templateId } = req.params;

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
                message: "You can only fix your own templates",
            });
        }

        let needsUpdate = false;

        // Fix recipients that don't have signingOrder
        template.recipients = template.recipients.map((recipient, index) => {
            if (!recipient.signingOrder || recipient.signingOrder === null || recipient.signingOrder === undefined) {
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
            // Update signing status based on order
            await template.updateSigningStatus();
            await template.save();
        }

        res.json({
            success: true,
            message: needsUpdate ? "Template signing order fixed" : "Template signing order was already correct",
            data: template,
        });
    } catch (error) {
        console.error("Error fixing template signing order:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fix template signing order",
            error: error.message,
        });
    }
};