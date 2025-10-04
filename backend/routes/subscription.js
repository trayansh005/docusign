import express from "express";
import Subscription from "../models/Subscription.js";
import { authenticate } from "../middleware/auth.js";

const router = express.Router();

// Get user subscriptions
router.get("/", authenticate, async (req, res) => {
	try {
		const subscriptions = await Subscription.find({ user: req.user.id }).populate("user");
		res.json(subscriptions);
	} catch (err) {
		res.status(500).json({ message: err.message });
	}
});

// Create subscription
router.post("/", authenticate, async (req, res) => {
	try {
		const { plan, price } = req.body;
		const subscription = new Subscription({ user: req.user.id, plan, price });
		await subscription.save();
		res.status(201).json(subscription);
	} catch (err) {
		res.status(400).json({ message: err.message });
	}
});

export default router;
