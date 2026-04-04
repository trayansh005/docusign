import Stripe from "stripe";
import Plan from "../models/Plan.js";
import Subscription from "../models/Subscription.js";
import User from "../models/User.js";
import mongoose from "mongoose";

const stripeSecret = process.env.STRIPE_SECRET_KEY;
const stripe = stripeSecret ? new Stripe(stripeSecret, { apiVersion: "2023-08-16" }) : null;

export const createCheckoutSession = async (request, reply) => {
  try {
    const userId = request.user?.id;
    const { planId } = request.body;
    const plan = await Plan.findById(planId);

    if (!stripe) {
      return reply.status(500).send({ success: false, message: "Stripe not configured" });
    }

    if (!plan?.stripePriceId) {
      request.log.error("Plan missing stripePriceId:", plan?.name);
      return reply.status(500).send({
        success: false,
        message: "Plan not configured for Stripe. Please run: npm run sync:stripe",
      });
    }

    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
    const idempotencyKey = `checkout-${userId}-${planId}-${Date.now()}`;

    const session = await stripe.checkout.sessions.create(
      {
        mode: "subscription",
        payment_method_types: ["card"],
        line_items: [{ price: plan.stripePriceId, quantity: 1 }],
        metadata: { userId: String(userId), planId: String(planId) },
        success_url: `${frontendUrl}/subscription?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${frontendUrl}/subscription?canceled=true`,
      },
      { idempotencyKey }
    );

    return { success: true, url: session.url };
  } catch (error) {
    request.log.error("createCheckoutSession error:", error);
    return reply.status(500).send({ success: false, message: "Failed to create checkout session" });
  }
};

export const verifySession = async (request, reply) => {
  const session = await mongoose.startSession();

  try {
    const userId = request.user?.id;
    const { sessionId } = request.body;

    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return reply.status(400).send({ success: false, message: "Invalid user" });
    }

    if (!sessionId) {
      return reply.status(400).send({ success: false, message: "Session ID required" });
    }

    if (!stripe) {
      return reply.status(500).send({ success: false, message: "Stripe not configured" });
    }

    const stripeSession = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["subscription"],
    });

    if (stripeSession.metadata?.userId !== String(userId)) {
      return reply.status(403).send({ success: false, message: "Session does not belong to user" });
    }

    if (stripeSession.payment_status !== "paid") {
      return {
        success: false,
        message: "Payment not completed yet",
        status: stripeSession.payment_status,
      };
    }

    const { planId } = stripeSession.metadata;
    const stripeSubscriptionId = stripeSession.subscription?.id || stripeSession.subscription;

    if (!planId) {
      return reply.status(400).send({ success: false, message: "Missing plan ID in session" });
    }

    let result;
    await session.withTransaction(async () => {
      if (stripeSubscriptionId) {
        const existing = await Subscription.findOne({
          externalSubscriptionId: stripeSubscriptionId,
        }).session(session);

        if (existing) {
          await existing.populate("planId");
          result = { success: true, subscription: existing, alreadyExists: true };
          return;
        }
      }

      const existingActive = await Subscription.findOne({
        userId,
        status: "active",
      }).session(session);

      if (existingActive) {
        existingActive.status = "cancelled";
        existingActive.autoRenew = false;
        await existingActive.save({ session });
      }

      const plan = await Plan.findById(planId).session(session);
      if (!plan || !plan.isActive) throw new Error("Plan not found or inactive");

      const startDate = new Date();
      const endDate = new Date(startDate);
      if (plan.interval === "month") endDate.setMonth(endDate.getMonth() + 1);
      else if (plan.interval === "year") endDate.setFullYear(endDate.getFullYear() + 1);

      const subscription = new Subscription({
        userId,
        planId,
        startDate,
        endDate,
        status: "active",
        paymentMethod: "stripe",
        externalSubscriptionId: stripeSubscriptionId || undefined,
      });

      await subscription.save({ session });
      await User.findByIdAndUpdate(userId, { currentSubscription: subscription._id }, { session });
      await subscription.populate({
        path: "planId",
        select: "name description price currency interval features",
      });

      result = { success: true, subscription };
    });

    return result;
  } catch (error) {
    request.log.error("verifySession error:", error);
    return reply.status(500).send({
      success: false,
      message: error.message || "Failed to verify session",
    });
  } finally {
    await session.endSession();
  }
};

export const stripeWebhook = async (request, reply) => {
  request.log.info("🔔 Webhook received!");
  const rawBody = request.rawBody; // Assumes fastify-raw-body plugin is used
  const sig = request.headers["stripe-signature"];

  let event;
  try {
    if (process.env.STRIPE_WEBHOOK_SECRET && stripe && rawBody) {
      event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } else {
      event = request.body;
    }
  } catch (err) {
    request.log.error("Webhook signature verification failed.", err.message);
    return reply.status(400).send(`Webhook Error: ${err.message}`);
  }

  request.log.info(`Event type: ${event.type}`);

  try {
    const type = event.type;

    if (type === "checkout.session.completed") {
      const session = event.data.object;
      let stripeSubscriptionId = session.subscription;
      
      if (!stripeSubscriptionId && stripe) {
        const fetched = await stripe.checkout.sessions.retrieve(session.id, {
          expand: ["subscription"],
        });
        stripeSubscriptionId = fetched.subscription?.id;
      }

      const { userId, planId } = session.metadata || {};
      if (!userId || !planId) {
        request.log.warn("Webhook session completed missing metadata");
        return { received: true };
      }

      if (stripeSubscriptionId) {
        const existing = await Subscription.findOne({ externalSubscriptionId: stripeSubscriptionId });
        if (existing) {
          request.log.info("Subscription for stripe id already exists, skipping creation.");
          return { received: true };
        }
      }

      const plan = await Plan.findById(planId);
      if (!plan) {
        request.log.warn(`Plan not found for planId ${planId}`);
        return { received: true };
      }

      const startDate = new Date();
      const endDate = new Date(startDate);
      if (plan.interval === "month") endDate.setMonth(endDate.getMonth() + 1);
      else if (plan.interval === "year") endDate.setFullYear(endDate.getFullYear() + 1);

      const subscription = new Subscription({
        userId,
        planId,
        startDate,
        endDate,
        status: "active",
        paymentMethod: "stripe",
        externalSubscriptionId: stripeSubscriptionId || undefined,
      });

      await subscription.save();
      await User.findByIdAndUpdate(userId, { currentSubscription: subscription._id });
      request.log.info(`Created subscription from Stripe webhook for user ${userId}`);
    } else if (type === "customer.subscription.updated" || type === "customer.subscription.deleted") {
      const subscriptionObj = event.data.object;
      const stripeSubId = subscriptionObj.id;
      
      const local = await Subscription.findOne({ externalSubscriptionId: stripeSubId });
      if (!local) {
        request.log.warn(`Received stripe event for unknown subscription id ${stripeSubId}`);
        return { received: true };
      }

      if (typeof subscriptionObj.cancel_at_period_end !== "undefined") {
        local.cancelAtPeriodEnd = Boolean(subscriptionObj.cancel_at_period_end);
      }

      if (subscriptionObj.current_period_end) {
        local.endDate = new Date(subscriptionObj.current_period_end * 1000);
      }

      if (subscriptionObj.status === "canceled") {
        local.status = "cancelled";
        local.cancelledAt = new Date();
      }

      await local.save();

      if (type === "customer.subscription.deleted") {
        await User.findByIdAndUpdate(local.userId, { currentSubscription: null });
      }
      request.log.info(`Synced subscription from Stripe event ${stripeSubId}`);
    }
  } catch (err) {
    request.log.error("Error processing Stripe webhook event:", err);
  }

  return { received: true };
};

