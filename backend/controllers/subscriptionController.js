import Plan from "../models/Plan.js";
import Subscription from "../models/Subscription.js";
import User from "../models/User.js";
import mongoose from "mongoose";
import Stripe from "stripe";

const stripeSecret = process.env.STRIPE_SECRET_KEY;
const stripe = stripeSecret ? new Stripe(stripeSecret, { apiVersion: "2023-08-16" }) : null;

// Get all available plans
export const getPlans = async (request, reply) => {
  try {
    const plans = await Plan.find({ isActive: true }).sort({ priority: 1 });
    return { success: true, plans };
  } catch (error) {
    request.log.error("Error fetching plans:", error);
    return reply.status(500).send({ success: false, message: "Failed to fetch plans" });
  }
};

// Get user's current subscription
export const getUserSubscription = async (request, reply) => {
  try {
    const userId = request.user.id;

    const subscription = await Subscription.findOne({
      userId,
      status: "active",
    }).populate({
      path: "planId",
      select: "name description price currency interval features stripePriceId stripeProductId",
    });

    if (!subscription) {
      return { success: true, subscription: null };
    }

    const subObj = subscription.toObject({ virtuals: false });
    subObj.currentPeriodStart = subscription.startDate;
    subObj.currentPeriodEnd = subscription.endDate;
    return { success: true, subscription: subObj };
  } catch (error) {
    request.log.error("Error fetching user subscription:", error);
    return reply.status(500).send({ success: false, message: "Failed to fetch subscription" });
  }
};

// Create a new subscription (manual/local version)
export const createSubscription = async (request, reply) => {
  const session = await mongoose.startSession();

  try {
    let result;
    await session.withTransaction(async () => {
      const userId = request.user.id;
      const { planId } = request.body;
      const plan = await Plan.findById(planId).session(session);

      if (!plan) throw new Error("Plan not found");

      const existingSubscription = await Subscription.findOne({
        userId,
        status: "active",
      }).session(session);

      if (existingSubscription) {
        throw new Error("User already has an active subscription");
      }

      const startDate = new Date();
      const endDate = new Date(startDate);
      if (plan.interval === "month") {
        endDate.setMonth(endDate.getMonth() + 1);
      } else if (plan.interval === "year") {
        endDate.setFullYear(endDate.getFullYear() + 1);
      }

      const subscription = new Subscription({
        userId,
        planId,
        startDate,
        endDate,
        status: "active",
        paymentMethod: "manual",
        price: plan.price,
      });

      await subscription.save({ session });
      await User.findByIdAndUpdate(userId, { currentSubscription: subscription._id }, { session });
      await subscription.populate({
        path: "planId",
        select: "name description price currency interval features",
      });

      result = subscription;
    });
    return reply.status(201).send({ success: true, subscription: result });
  } catch (error) {
    request.log.error("Error creating subscription:", error);
    const statusCode = error.message.includes("already has") ? 400 : 500;
    return reply.status(statusCode).send({
      success: false,
      message: error.message || "Failed to create subscription",
    });
  } finally {
    await session.endSession();
  }
};

// Cancel subscription
export const cancelSubscription = async (request, reply) => {
  const session = await mongoose.startSession();

  try {
    let result;
    await session.withTransaction(async () => {
      const userId = request.user.id;
      const { mode } = request.body || {};
      const cancelMode = mode === "immediate" ? "immediate" : "at_period_end";

      const subscription = await Subscription.findOne({
        userId,
        status: "active",
      }).session(session);

      if (!subscription) {
        throw new Error("No active subscription found");
      }

      if (subscription.paymentMethod === "stripe" && subscription.externalSubscriptionId) {
        if (!stripe) {
          throw new Error("Stripe not configured");
        }

        const stripeSubId = subscription.externalSubscriptionId;

        if (cancelMode === "at_period_end") {
          try {
            await stripe.subscriptions.update(stripeSubId, { cancel_at_period_end: true });
            subscription.cancelAtPeriodEnd = true;
            subscription.autoRenew = false;
            await subscription.save({ session });
            result = {
              success: true,
              message: "Subscription will be canceled at the end of the current billing period",
              subscription,
            };
            return;
          } catch (err) {
            request.log.error("Stripe update (cancel at period end) failed:", err);
            throw new Error("Failed to schedule cancellation with payment provider");
          }
        } else {
          try {
            await stripe.subscriptions.del(stripeSubId);
            subscription.status = "cancelled";
            subscription.autoRenew = false;
            subscription.cancelledAt = new Date();
            await subscription.save({ session });
            await User.findByIdAndUpdate(userId, { currentSubscription: null }, { session });
            result = {
              success: true,
              message: "Subscription cancelled immediately",
              subscription,
            };
            return;
          } catch (err) {
            request.log.error("Stripe delete subscription failed:", err);
            throw new Error("Failed to cancel subscription with payment provider");
          }
        }
      }

      if (cancelMode === "at_period_end") {
        subscription.cancelAtPeriodEnd = true;
        subscription.autoRenew = false;
        await subscription.save({ session });
        result = {
          success: true,
          message: "Subscription will be canceled at the end of the current billing period",
          subscription,
        };
      } else {
        subscription.status = "cancelled";
        subscription.autoRenew = false;
        subscription.cancelledAt = new Date();
        await subscription.save({ session });
        await User.findByIdAndUpdate(userId, { currentSubscription: null }, { session });
        result = { success: true, message: "Subscription cancelled successfully", subscription };
      }
    });
    return result;
  } catch (error) {
    request.log.error("Error cancelling subscription:", error);
    const statusCode = error.message.includes("No active") ? 400 : 500;
    return reply.status(statusCode).send({
      success: false,
      message: error.message || "Failed to cancel subscription",
    });
  } finally {
    await session.endSession();
  }
};

// Delete subscription by ID
export const deleteSubscription = async (request, reply) => {
  const session = await mongoose.startSession();

  try {
    let result;
    await session.withTransaction(async () => {
      const userId = request.user.id;
      const { id: subscriptionId } = request.params;

      const subscription = await Subscription.findById(subscriptionId).session(session);

      if (!subscription) throw new Error("Subscription not found");

      if (subscription.userId.toString() !== userId.toString()) {
        throw new Error("Unauthorized: You can only delete your own subscriptions");
      }

      if (subscription.paymentMethod === "stripe" && subscription.externalSubscriptionId) {
        if (stripe) {
          try {
            await stripe.subscriptions.del(subscription.externalSubscriptionId);
          } catch (stripeError) {
            request.log.error("Failed to cancel Stripe subscription:", stripeError);
          }
        }
      }

      subscription.status = "cancelled";
      subscription.autoRenew = false;
      subscription.cancelledAt = new Date();
      await subscription.save({ session });

      const user = await User.findById(userId).session(session);
      if (user.currentSubscription && user.currentSubscription.toString() === subscriptionId) {
        user.currentSubscription = null;
        await user.save({ session });
      }

      result = {
        success: true,
        message: "Subscription deleted successfully",
        subscription
      };
    });
    return result;
  } catch (error) {
    request.log.error("Error deleting subscription:", error);
    const statusCode = error.message.includes("not found") ? 404 :
      error.message.includes("Unauthorized") ? 403 : 500;
    return reply.status(statusCode).send({
      success: false,
      message: error.message || "Failed to delete subscription",
    });
  } finally {
    await session.endSession();
  }
};