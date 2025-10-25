import express from "express";
import { authenticate } from "../middleware/auth.js";
import {
	getPlans,
	getUserSubscription,
	createSubscription,
	cancelSubscription,
	deleteSubscription,
} from "../controllers/subscriptionController.js";
import {
	createCheckoutSession,
	verifySession,
	stripeWebhook,
} from "../controllers/stripeController.js";

const router = express.Router();

// Plans
router.get("/plans", getPlans);

// User subscription
router.get("/me", authenticate, getUserSubscription);

// Create (manual) subscription
router.post("/", authenticate, createSubscription);

// Cancel
router.post("/cancel", authenticate, cancelSubscription);

// Delete subscription by ID (admin/user action)
router.delete("/:id", authenticate, deleteSubscription);

// Stripe checkout creation
router.post("/checkout", authenticate, createCheckoutSession);

// Verify session (manual / fallback)
router.post("/verify", authenticate, verifySession);

// Webhook - needs raw body when mounted; Wire expects express.json by default in server.js
router.post("/webhook", express.raw({ type: "application/json" }), stripeWebhook);

export default router;
