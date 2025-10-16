#!/usr/bin/env node
import dotenv from "dotenv";
dotenv.config();
import mongoose from "mongoose";
import connectDB from "../database/connection.js";
import Plan from "../models/Plan.js";

const seedPlans = async () => {
	try {
		await connectDB();

		const plans = [
			{
				name: "Professional",
				description: "Ideal for small businesses and teams",
				price: 29,
				interval: "month",
				features: [
					"Up to 100 documents per month",
					"Advanced signature fields",
					"Document templates",
					"Team collaboration",
					"Priority support",
					"API access",
					"Custom branding",
				],
				isActive: true,
				priority: 1,
			},
			{
				name: "Enterprise",
				description: "For large organizations with advanced needs",
				price: 99,
				interval: "month",
				features: [
					"Unlimited documents",
					"All Professional features",
					"Advanced analytics",
					"SSO integration",
					"Dedicated support",
					"Custom integrations",
					"Compliance tools",
					"24/7 phone support",
				],
				isActive: true,
				priority: 0,
			},
		];

		for (const p of plans) {
			const existing = await Plan.findOne({ name: p.name });
			if (existing) {
				console.log(`Plan ${p.name} already exists, skipping`);
				continue;
			}

			const plan = new Plan(p);
			await plan.save();
			console.log(`Created plan: ${plan.name}`);
		}

		console.log("Seeding complete");
	} catch (err) {
		console.error("Seeding failed:", err);
	} finally {
		await mongoose.disconnect();
		process.exit(0);
	}
};

seedPlans();
