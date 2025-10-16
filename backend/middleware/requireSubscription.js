import Subscription from "../models/Subscription.js";

// Middleware to require an active subscription on the authenticated user
export const requireActiveSubscription = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Authentication required" });
    }

    const now = new Date();

    // Consider a subscription active if status === 'active' and endDate is in the future (or not set)
    const subscription = await Subscription.findOne({
      userId,
      status: "active",
      $or: [{ endDate: { $exists: false } }, { endDate: { $gt: now } }],
    });

    if (!subscription) {
      return res.status(403).json({ success: false, message: "Active subscription required" });
    }

    // Attach subscription to request for downstream handlers if needed
    req.subscription = subscription;
    next();
  } catch (err) {
    console.error("requireActiveSubscription error:", err);
    return res.status(500).json({ success: false, message: "Subscription check failed" });
  }
};

export default requireActiveSubscription;
