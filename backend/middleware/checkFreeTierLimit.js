import Subscription from "../models/Subscription.js";
import DocuSignTemplate from "../models/DocuSignTemplate.js";
import { getFreeTierLimits } from "../utils/freeTierLimits.js";

/**
 * Middleware to check if a free-tier user has exceeded their monthly signing limit
 * This should be applied to endpoints that finalize/sign documents
 */
export const checkFreeTierSigningLimit = async (request, reply) => {
  try {
    const userId = request.user?.id || request.user?._id;

    if (!userId) {
      return reply.status(401).send({ success: false, message: "Unauthorized" });
    }

    const now = new Date();
    const activeSub = await Subscription.findOne({
      userId,
      status: "active",
      $or: [{ endDate: { $exists: false } }, { endDate: { $gt: now } }],
    }).select("_id");

    if (activeSub) return;

    const { signedLimit } = getFreeTierLimits();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const signedThisMonth = await DocuSignTemplate.countDocuments({
      createdBy: userId,
      status: "final",
      updatedAt: { $gte: monthStart },
      isArchived: { $ne: true },
    });

    if (signedThisMonth >= signedLimit) {
      return reply.status(403).send({
        success: false,
        message: `Free plan limit reached. You can only sign ${signedLimit} documents per month. Please upgrade to continue.`,
        code: "FREE_TIER_LIMIT_EXCEEDED",
        limit: signedLimit,
        used: signedThisMonth,
      });
    }
  } catch (error) {
    request.log.error("Error checking free tier limit:", error);
    return reply.status(500).send({
      success: false,
      message: "Failed to verify signing limits",
    });
  }
};

