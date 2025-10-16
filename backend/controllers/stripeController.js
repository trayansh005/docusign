import dotenv from "dotenv";
dotenv.config();
import Stripe from "stripe";
import Plan from "../models/Plan.js";
import Subscription from "../models/Subscription.js";
import User from "../models/User.js";
import mongoose from "mongoose";

const stripeSecret = process.env.STRIPE_SECRET_KEY;
if (!stripeSecret) {
	console.warn(
		"STRIPE_SECRET_KEY not set - Stripe will not be initialized. Set it in your .env for testing."
	);
}

const stripe = stripeSecret ? new Stripe(stripeSecret, { apiVersion: "2023-08-16" }) : null;

export const createCheckoutSession = async (req, res) => {
	try {
		const userId = req.user?.id;
		const { planId } = req.body;
		const plan = await Plan.findById(planId);

		if (!stripe) {
			return res.status(500).json({ success: false, message: "Stripe not configured" });
		}

		// Check if plan has Stripe Price ID
		if (!plan?.stripePriceId) {
			console.error("Plan missing stripePriceId:", plan?.name);
			return res.status(500).json({
				success: false,
				message: "Plan not configured for Stripe. Please run: npm run sync:stripe",
			});
		}

		const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";

		// Creating checkout session for plan

		// Create idempotency key to prevent duplicate sessions
		const idempotencyKey = `checkout-${userId}-${planId}-${Date.now()}`;

		// Create Checkout Session using the Stripe Price ID
		const session = await stripe.checkout.sessions.create(
			{
				mode: "subscription",
				payment_method_types: ["card"],
				line_items: [
					{
						price: plan.stripePriceId,
						quantity: 1,
					},
				],
				metadata: {
					userId: String(userId),
					planId: String(planId),
				},
				success_url: `${frontendUrl}/subscription?session_id={CHECKOUT_SESSION_ID}`,
				cancel_url: `${frontendUrl}/subscription?canceled=true`,
			},
			{
				idempotencyKey,
			}
		);

		// Checkout session created

		return res.json({ success: true, url: session.url });
	} catch (error) {
		console.error("createCheckoutSession error:", error);
		res.status(500).json({ success: false, message: "Failed to create checkout session" });
	}
};

// Verify and fulfill session (manual trigger)
export const verifySession = async (req, res) => {
	const session = await mongoose.startSession();

	try {
		const userId = req.user?.id;
		const { sessionId } = req.body;

		if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
			return res.status(400).json({ success: false, message: "Invalid user" });
		}

		if (!sessionId) {
			return res.status(400).json({ success: false, message: "Session ID required" });
		}

		if (!stripe) {
			return res.status(500).json({ success: false, message: "Stripe not configured" });
		}

		// Verifying session

		// Retrieve the session from Stripe
		const stripeSession = await stripe.checkout.sessions.retrieve(sessionId, {
			expand: ["subscription"],
		});

		// session status available in stripeSession.payment_status

		// Verify the session belongs to this user
		if (stripeSession.metadata?.userId !== String(userId)) {
			return res.status(403).json({ success: false, message: "Session does not belong to user" });
		}

		// Check if payment was successful
		if (stripeSession.payment_status !== "paid") {
			return res.json({
				success: false,
				message: "Payment not completed yet",
				status: stripeSession.payment_status,
			});
		}

		const { planId } = stripeSession.metadata;
		const stripeSubscriptionId = stripeSession.subscription?.id || stripeSession.subscription;

		if (!planId) {
			return res.status(400).json({ success: false, message: "Missing plan ID in session" });
		}

		// Use transaction to prevent race conditions
		let result;
		await session.withTransaction(async () => {
			// Check if subscription already exists for this Stripe subscription ID
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

			// Check if user already has an active subscription
			const existingActive = await Subscription.findOne({
				userId,
				status: "active",
			}).session(session);

			if (existingActive) {
				existingActive.status = "cancelled";
				existingActive.autoRenew = false;
				await existingActive.save({ session });
			}

			// Get the plan
			const plan = await Plan.findById(planId).session(session);
			if (!plan || !plan.isActive) {
				throw new Error("Plan not found or inactive");
			}

			// Creating subscription for plan

			// Create subscription record
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

			// Update user's current subscription
			await User.findByIdAndUpdate(userId, { currentSubscription: subscription._id }, { session });

			// Populate the subscription for response
			await subscription.populate({
				path: "planId",
				select: "name description price currency interval features",
			});

			result = { success: true, subscription };
		});

		return res.json(result);
	} catch (error) {
		console.error("verifySession error:", error);
		res.status(500).json({
			success: false,
			message: error.message || "Failed to verify session",
		});
	} finally {
		await session.endSession();
	}
};

// Webhook handler
export const stripeWebhook = async (req, res) => {
	console.log("🔔 Webhook received!");
	const rawBody = req.body;
	const sig = req.headers["stripe-signature"];

	let event;

	try {
		if (process.env.STRIPE_WEBHOOK_SECRET && stripe) {
			event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
		} else {
			if (Buffer.isBuffer(rawBody)) {
				event = JSON.parse(rawBody.toString());
			} else if (typeof rawBody === "string") {
				event = JSON.parse(rawBody);
			} else {
				event = rawBody;
			}
		}
	} catch (err) {
		console.error("Webhook signature verification failed.", err.message);
		return res.status(400).send(`Webhook Error: ${err.message}`);
	}

	console.log("Event type:", event.type);

	try {
		const type = event.type || event?.type;

		if (type === "checkout.session.completed") {
			console.log("🎉 Processing checkout.session.completed");
			const session = event.data.object;

			let stripeSubscriptionId = session.subscription;
			if (!stripeSubscriptionId && stripe) {
				const fetched = await stripe.checkout.sessions.retrieve(session.id, {
					expand: ["subscription"],
				});
				stripeSubscriptionId = fetched.subscription?.id;
			}

			const metadata = session.metadata || {};
			const { userId, planId } = metadata;

			if (!userId || !planId) {
				console.warn("Webhook session completed missing metadata");
				return res.json({ received: true });
			}

			// Avoid creating duplicate subscriptions
			if (stripeSubscriptionId) {
				const existing = await Subscription.findOne({
					externalSubscriptionId: stripeSubscriptionId,
				});
				if (existing) {
					console.log("✅ Subscription for stripe id already exists, skipping creation.");
					return res.json({ received: true });
				}
			}

			const plan = await Plan.findById(planId);
			if (!plan) {
				console.warn("Plan not found while handling webhook for planId", planId);
				return res.json({ received: true });
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

			// Update user's current subscription
			await User.findByIdAndUpdate(userId, { currentSubscription: subscription._id });

			console.log("🎉 Created subscription from Stripe webhook for user", userId);
		} else {
			// Handle subscription updates and deletions
			if (type === "customer.subscription.updated" || type === "customer.subscription.deleted") {
				const subscriptionObj = event.data.object;
				const stripeSubId = subscriptionObj.id;
				try {
					const local = await Subscription.findOne({ externalSubscriptionId: stripeSubId });
					if (!local) {
						console.warn("Received stripe event for unknown subscription id", stripeSubId);
						return res.json({ received: true });
					}

					// Update cancel at period end flag
					if (typeof subscriptionObj.cancel_at_period_end !== "undefined") {
						local.cancelAtPeriodEnd = Boolean(subscriptionObj.cancel_at_period_end);
					}

					// Update end date (current_period_end)
					if (subscriptionObj.current_period_end) {
						local.endDate = new Date(subscriptionObj.current_period_end * 1000);
					}

					// Map Stripe status to local status
					if (subscriptionObj.status === "canceled" || subscriptionObj.status === "canceled") {
						local.status = "cancelled";
						local.cancelledAt = new Date();
					}

					await local.save();

					// If deleted, clear user's currentSubscription
					if (type === "customer.subscription.deleted") {
						await User.findByIdAndUpdate(local.userId, { currentSubscription: null });
					}
					console.log("✅ Synced subscription from Stripe event", stripeSubId);
				} catch (err) {
					console.error("Error syncing subscription from Stripe event:", err);
				}
			} else {
				console.log("ℹ️ Ignoring event type:", type);
			}
		}
	} catch (err) {
		console.error("❌ Error processing Stripe webhook event:", err);
	}

	res.json({ received: true });
};
