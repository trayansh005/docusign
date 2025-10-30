import Subscription from "../models/Subscription.js";
import DocuSignTemplate from "../models/DocuSignTemplate.js";
import { getFreeTierLimits } from "../utils/freeTierLimits.js";

/**
 * Middleware to check if a free-tier user has exceeded their monthly signing limit
 * This should be applied to endpoints that finalize/sign documents
 */
export const checkFreeTierSigningLimit = async (req, res, next) => {
    try {
        const userId = req.user?.id || req.user?._id;

        if (!userId) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }

        // Check if user has an active subscription
        const now = new Date();
        const activeSub = await Subscription.findOne({
            userId,
            status: "active",
            $or: [{ endDate: { $exists: false } }, { endDate: { $gt: now } }],
        }).select("_id");

        // If user has active subscription, allow unlimited signing
        if (activeSub) {
            return next();
        }

        // User is on free tier - check monthly limit
        const { signedLimit } = getFreeTierLimits();

        // Calculate current month start date
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

        // Count documents signed this month
        const signedThisMonth = await DocuSignTemplate.countDocuments({
            createdBy: userId,
            status: "final",
            updatedAt: { $gte: monthStart },
            isArchived: { $ne: true },
        });

        if (signedThisMonth >= signedLimit) {
            return res.status(403).json({
                success: false,
                message: `Free plan limit reached. You can only sign ${signedLimit} documents per month. Please upgrade to continue.`,
                code: "FREE_TIER_LIMIT_EXCEEDED",
                limit: signedLimit,
                used: signedThisMonth,
            });
        }

        // User is within limit, proceed
        next();
    } catch (error) {
        console.error("Error checking free tier limit:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to verify signing limits",
        });
    }
};
