import express from "express";
import { authenticateSession } from "../middleware/sessionAuth.js";
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
router.get("/me", authenticateSession, getUserSubscription);

// Create (manual) subscription
router.post("/", authenticateSession, createSubscription);

// Cancel
router.post("/cancel", authenticateSession, cancelSubscription);

// Delete subscription by ID (admin/user action)
router.delete("/:id", authenticateSession, deleteSubscription);

// Stripe checkout creation
router.post("/checkout", authenticateSession, createCheckoutSession);

// Verify session (manual / fallback)
router.post("/verify", authenticateSession, verifySession);

// Webhook - needs raw body when mounted; Wire expects express.json by default in server.js
router.post("/webhook", express.raw({ type: "application/json" }), stripeWebhook);

export default router;
