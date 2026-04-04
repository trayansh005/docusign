import mongoose from "mongoose";
import DocuSignTemplate from "../models/DocuSignTemplate.js";
import Subscription from "../models/Subscription.js";
import User from "../models/User.js";
import { getFreeTierLimits } from "../utils/freeTierLimits.js";

// GET /api/dashboard/stats
export const getUserStats = async (request, reply) => {
  try {
    const userId = request.user?.id || request.user?._id;
    const email = request.user?.email;

    if (!userId) return reply.status(401).send({ success: false, message: "Unauthorized" });

    const userObjectId = new mongoose.Types.ObjectId(userId);

    const ownerStatsResult = await DocuSignTemplate.aggregate([
      {
        $match: {
          createdBy: userObjectId,
          isArchived: { $ne: true },
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          pending: { $sum: { $cond: [{ $ne: ["$status", "final"] }, 1, 0] } },
          completed: { $sum: { $cond: [{ $eq: ["$status", "final"] }, 1, 0] } },
        },
      },
    ]);

    const ownerStats = ownerStatsResult[0] || { total: 0, pending: 0, completed: 0 };

    const assignedOrConditions = [
      { "signatureFields.recipientId": String(userId) },
      { "recipients.userId": userObjectId },
      { "recipients.id": String(userId) },
    ];
    if (email) {
      assignedOrConditions.push({ "recipients.email": email });
    }

    const assignedStatsResult = await DocuSignTemplate.aggregate([
      {
        $match: {
          isArchived: { $ne: true },
          $or: assignedOrConditions,
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          pending: { $sum: { $cond: [{ $ne: ["$status", "final"] }, 1, 0] } },
          completed: { $sum: { $cond: [{ $eq: ["$status", "final"] }, 1, 0] } },
        },
      },
    ]);

    const assignedStats = assignedStatsResult[0] || { total: 0, pending: 0, completed: 0 };

    const now = new Date();
    const activeSub = await Subscription.findOne({
      userId,
      status: "active",
      $or: [{ endDate: { $exists: false } }, { endDate: { $gt: now } }],
    }).select("_id");

    let usage = null;
    if (!activeSub) {
      const { uploadLimit, signedLimit } = getFreeTierLimits();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      const uploadsUsed = await DocuSignTemplate.countDocuments({
        createdBy: userObjectId,
        isArchived: { $ne: true },
      });

      const signUsed = await DocuSignTemplate.countDocuments({
        createdBy: userObjectId,
        isArchived: { $ne: true },
        status: "final",
        updatedAt: { $gte: monthStart },
      });

      usage = {
        hasActiveSubscription: false,
        uploads: { used: uploadsUsed, limit: uploadLimit },
        signs: { used: signUsed, limit: signedLimit },
      };
    } else {
      usage = { hasActiveSubscription: true };
    }

    return {
      success: true,
      data: {
        owner: {
          total: ownerStats.total,
          pending: ownerStats.pending,
          completed: ownerStats.completed,
        },
        assigned: {
          total: assignedStats.total,
          pending: assignedStats.pending,
          completed: assignedStats.completed,
        },
        usage,
      },
    };
  } catch (error) {
    request.log.error("getUserStats error", error);
    return reply.status(500).send({ success: false, message: error.message || "Failed to compute stats" });
  }
};

// GET /api/dashboard/pending-count
export const getPendingDocumentsCount = async (request, reply) => {
  try {
    const userId = request.user?.id || request.user?._id;
    const email = request.user?.email;

    if (!userId) return reply.status(401).send({ success: false, message: "Unauthorized" });

    const userObjectId = new mongoose.Types.ObjectId(userId);

    const assignedFilter = {
      isArchived: { $ne: true },
      status: { $ne: "final" },
      $or: [
        { "signatureFields.recipientId": String(userId) },
        { "recipients.userId": userObjectId },
        { "recipients.id": String(userId) },
      ],
    };

    if (email) {
      assignedFilter.$or.push({ "recipients.email": email });
    }

    const templates = await DocuSignTemplate.find(assignedFilter).select("recipients updatedAt").lean();

    const pendingTemplates = templates.filter((template) => {
      const myRecipient = template.recipients?.find(
        (r) =>
          r.userId?.toString() === userId.toString() ||
          r.id === String(userId) ||
          r.email === email
      );
      return myRecipient && (myRecipient.signatureStatus === "pending" || myRecipient.signatureStatus === "waiting");
    });

    const pendingCount = pendingTemplates.length;
    const user = await User.findById(userId).select("lastNotificationReadAt").lean();
    const lastReadAt = user?.lastNotificationReadAt;

    let unreadCount = pendingCount;
    if (lastReadAt) {
      unreadCount = pendingTemplates.filter((t) => new Date(t.updatedAt) > new Date(lastReadAt)).length;
    }

    return {
      success: true,
      data: {
        pendingCount,
        unreadCount,
      },
    };
  } catch (error) {
    request.log.error("getPendingDocumentsCount error", error);
    return reply.status(500).send({ success: false, message: error.message || "Failed to get pending count" });
  }
};

// POST /api/dashboard/mark-notifications-read
export const markNotificationsRead = async (request, reply) => {
  try {
    const userId = request.user?.id || request.user?._id;
    if (!userId) return reply.status(401).send({ success: false, message: "Unauthorized" });

    await User.findByIdAndUpdate(userId, {
      lastNotificationReadAt: new Date(),
    });

    return {
      success: true,
      message: "Notifications marked as read",
    };
  } catch (error) {
    request.log.error("markNotificationsRead error", error);
    return reply.status(500).send({ success: false, message: error.message || "Failed to mark notifications as read" });
  }
};

// GET /api/dashboard/inbox
export const getInbox = async (request, reply) => {
  try {
    const userId = request.user?.id || request.user?._id;
    const email = request.user?.email;
    const { page = 1, limit = 10 } = request.query;

    if (!userId) return reply.status(401).send({ success: false, message: "Unauthorized" });

    const userObjectId = new mongoose.Types.ObjectId(userId);

    const assignedFilter = {
      isArchived: { $ne: true },
      $or: [
        { "signatureFields.recipientId": String(userId) },
        { "recipients.userId": userObjectId },
        { "recipients.id": String(userId) },
      ],
    };

    if (email) {
      assignedFilter.$or.push({ "recipients.email": email });
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await DocuSignTemplate.countDocuments(assignedFilter);

    const templates = await DocuSignTemplate.find(assignedFilter)
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .select("name status createdAt updatedAt finalPdfUrl metadata recipients message createdBy")
      .populate("createdBy", "firstName lastName email")
      .lean();

    const items = templates.map((t) => ({
      id: t._id,
      name: t.name || t.metadata?.filename || "Untitled",
      status: t.status,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
      finalPdfUrl: t.finalPdfUrl || (t.metadata && t.metadata.originalPdfPath) || "",
      sender: t.createdBy
        ? `${t.createdBy.firstName || ""} ${t.createdBy.lastName || ""}`.trim() || t.createdBy.email
        : "Unknown",
      message: t.message || { subject: "", body: "" },
      myRecipientInfo:
        t.recipients?.find(
          (r) =>
            r.userId?.toString() === userId.toString() ||
            r.id === String(userId) ||
            r.email === email
        ) || null,
    }));

    return {
      success: true,
      data: items,
      pagination: {
        current: parseInt(page),
        total,
        pages: Math.ceil(total / parseInt(limit)),
        limit: parseInt(limit),
      },
    };
  } catch (error) {
    request.log.error("getInbox error", error);
    return reply.status(500).send({ success: false, message: error.message || "Failed to load inbox" });
  }
};

