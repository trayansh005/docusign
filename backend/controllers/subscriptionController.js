import Plan from "../models/Plan.js";
import Subscription from "../models/Subscription.js";
import User from "../models/User.js";
import mongoose from "mongoose";
import Stripe from "stripe";

const stripeSecret = process.env.STRIPE_SECRET_KEY;
const stripe = stripeSecret ? new Stripe(stripeSecret, { apiVersion: "2023-08-16" }) : null;

// Get all available plans
export const getPlans = async (req, res) => {
	try {
		const plans = await Plan.find({ isActive: true }).sort({ priority: 1 });
		res.json({ success: true, plans });
	} catch (error) {
		console.error("Error fetching plans:", error);
		res.status(500).json({ success: false, message: "Failed to fetch plans" });
	}
};

// Get user's current subscription
export const getUserSubscription = async (req, res) => {
	try {
		const userId = req.user.id;

		const subscription = await Subscription.findOne({
			userId,
			status: "active",
		}).populate({
			path: "planId",
			select: "name description price currency interval features stripePriceId stripeProductId",
		});

		if (!subscription) {
			return res.json({ success: true, subscription: null });
		}

		// Shape response to include period fields expected by frontend
		const subObj = subscription.toObject({ virtuals: false });
		subObj.currentPeriodStart = subscription.startDate;
		subObj.currentPeriodEnd = subscription.endDate;
		res.json({ success: true, subscription: subObj });
	} catch (error) {
		console.error("Error fetching user subscription:", error);
		res.status(500).json({ success: false, message: "Failed to fetch subscription" });
	}
};

// Create a new subscription (manual/local version)
export const createSubscription = async (req, res) => {
	const session = await mongoose.startSession();

	try {
		await session.withTransaction(async () => {
			const userId = req.user.id;
			const { planId } = req.body;
			const plan = await Plan.findById(planId).session(session);

			if (!plan) throw new Error("Plan not found");

			// Check if user already has an active subscription
			const existingSubscription = await Subscription.findOne({
				userId,
				status: "active",
			}).session(session);

			if (existingSubscription) {
				throw new Error("User already has an active subscription");
			}

			// Calculate end date based on plan interval
			const startDate = new Date();
			const endDate = new Date(startDate);
			if (plan.interval === "month") {
				endDate.setMonth(endDate.getMonth() + 1);
			} else if (plan.interval === "year") {
				endDate.setFullYear(endDate.getFullYear() + 1);
			}

			// Create subscription
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

			// Update user's current subscription
			await User.findByIdAndUpdate(userId, { currentSubscription: subscription._id }, { session });

			// Populate the subscription for response
			await subscription.populate({
				path: "planId",
				select: "name description price currency interval features",
			});

			res.status(201).json({ success: true, subscription });
		});
	} catch (error) {
		console.error("Error creating subscription:", error);
		const statusCode = error.message.includes("already has") ? 400 : 500;
		res.status(statusCode).json({
			success: false,
			message: error.message || "Failed to create subscription",
		});
	} finally {
		await session.endSession();
	}
};

// Cancel subscription
export const cancelSubscription = async (req, res) => {
	const session = await mongoose.startSession();

	try {
		await session.withTransaction(async () => {
			const userId = req.user.id;
			const { mode } = req.body || {};
			// mode: 'at_period_end' (default) | 'immediate'
			const cancelMode = mode === "immediate" ? "immediate" : "at_period_end";

			const subscription = await Subscription.findOne({
				userId,
				status: "active",
			}).session(session);

			if (!subscription) {
				throw new Error("No active subscription found");
			}

			// If subscription is managed by Stripe, call Stripe API
			if (subscription.paymentMethod === "stripe" && subscription.externalSubscriptionId) {
				if (!stripe) {
					throw new Error("Stripe not configured");
				}

				const stripeSubId = subscription.externalSubscriptionId;

				if (cancelMode === "at_period_end") {
					// Tell Stripe to cancel at period end
					try {
						await stripe.subscriptions.update(stripeSubId, { cancel_at_period_end: true });
						// Update local subscription to reflect scheduled cancellation
						subscription.cancelAtPeriodEnd = true;
						subscription.autoRenew = false;
						await subscription.save({ session });
						// Keep user's currentSubscription until period end
						res.json({
							success: true,
							message: "Subscription will be canceled at the end of the current billing period",
							subscription,
						});
						return;
					} catch (err) {
						console.error("Stripe update (cancel at period end) failed:", err);
						throw new Error("Failed to schedule cancellation with payment provider");
					}
				} else {
					// immediate cancellation via Stripe
					try {
						await stripe.subscriptions.del(stripeSubId);
						subscription.status = "cancelled";
						subscription.autoRenew = false;
						subscription.cancelledAt = new Date();
						await subscription.save({ session });
						await User.findByIdAndUpdate(userId, { currentSubscription: null }, { session });
						res.json({
							success: true,
							message: "Subscription cancelled immediately",
							subscription,
						});
						return;
					} catch (err) {
						console.error("Stripe delete subscription failed:", err);
						throw new Error("Failed to cancel subscription with payment provider");
					}
				}
			}

			// No external provider (manual payment) or stripe not configured: handle locally
			if (cancelMode === "at_period_end") {
				subscription.cancelAtPeriodEnd = true;
				subscription.autoRenew = false;
				await subscription.save({ session });
				res.json({
					success: true,
					message: "Subscription will be canceled at the end of the current billing period",
					subscription,
				});
				return;
			} else {
				subscription.status = "cancelled";
				subscription.autoRenew = false;
				subscription.cancelledAt = new Date();
				await subscription.save({ session });

				await User.findByIdAndUpdate(userId, { currentSubscription: null }, { session });

				res.json({ success: true, message: "Subscription cancelled successfully", subscription });
				return;
			}
		});
	} catch (error) {
		console.error("Error cancelling subscription:", error);
		const statusCode = error.message.includes("No active") ? 400 : 500;
		res.status(statusCode).json({
			success: false,
			message: error.message || "Failed to cancel subscription",
		});
	} finally {
		await session.endSession();
	}
};

// Delete subscription by ID
export const deleteSubscription = async (req, res) => {
	const session = await mongoose.startSession();

	try {
		await session.withTransaction(async () => {
			const userId = req.user.id;
			const { id: subscriptionId } = req.params;

			// Find the subscription
			const subscription = await Subscription.findById(subscriptionId).session(session);

			if (!subscription) {
				throw new Error("Subscription not found");
			}

			// Check if user owns this subscription
			if (subscription.userId.toString() !== userId.toString()) {
				throw new Error("Unauthorized: You can only delete your own subscriptions");
			}

			// If subscription is managed by Stripe, cancel it there first
			if (subscription.paymentMethod === "stripe" && subscription.externalSubscriptionId) {
				if (stripe) {
					try {
						await stripe.subscriptions.del(subscription.externalSubscriptionId);
					} catch (stripeError) {
						console.error("Failed to cancel Stripe subscription:", stripeError);
						// Continue with local deletion even if Stripe fails
					}
				}
			}

			// Update subscription status to cancelled
			subscription.status = "cancelled";
			subscription.autoRenew = false;
			subscription.cancelledAt = new Date();
			await subscription.save({ session });

			// Remove from user's current subscription if it's the active one
			const user = await User.findById(userId).session(session);
			if (user.currentSubscription && user.currentSubscription.toString() === subscriptionId) {
				user.currentSubscription = null;
				await user.save({ session });
			}

			res.json({
				success: true,
				message: "Subscription deleted successfully",
				subscription
			});
		});
	} catch (error) {
		console.error("Error deleting subscription:", error);
		const statusCode = error.message.includes("not found") ? 404 :
			error.message.includes("Unauthorized") ? 403 : 500;
		res.status(statusCode).json({
			success: false,
			message: error.message || "Failed to delete subscription",
		});
	} finally {
		await session.endSession();
	}
};