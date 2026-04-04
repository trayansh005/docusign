import Subscription from "../models/Subscription.js";

/**
 * Middleware to require an active subscription on the authenticated user
 */
export const requireActiveSubscription = async (request, reply) => {
  try {
    const userId = request.user?.id;
    if (!userId) {
      return reply.status(401).send({ success: false, message: "Authentication required" });
    }

    const now = new Date();

    const subscription = await Subscription.findOne({
      userId,
      status: "active",
      $or: [{ endDate: { $exists: false } }, { endDate: { $gt: now } }],
    });

    if (!subscription) {
      return reply.status(403).send({ success: false, message: "Active subscription required" });
    }

    request.subscription = subscription;
  } catch (err) {
    request.log.error("requireActiveSubscription error:", err);
    return reply.status(500).send({ success: false, message: "Subscription check failed" });
  }
};

export default requireActiveSubscription;

