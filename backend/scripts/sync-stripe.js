#!/usr/bin/env node
import dotenv from "dotenv";
dotenv.config();
import Stripe from "stripe";
import connectDB from "../database/connection.js";
import Plan from "../models/Plan.js";
import mongoose from "mongoose";

const run = async () => {
	if (!process.env.STRIPE_SECRET_KEY) {
		console.error("STRIPE_SECRET_KEY not set in env. Aborting.");
		process.exit(1);
	}

	const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2023-08-16" });

	try {
		await connectDB();

		const plans = await Plan.find({ isActive: true });
		console.log(`Found ${plans.length} plans`);

		for (const plan of plans) {
			if (plan.stripePriceId) {
				console.log(`Plan ${plan.name} already has stripePriceId=${plan.stripePriceId}, skipping`);
				continue;
			}

			// Create product in Stripe
			console.log(`Creating Stripe product for plan ${plan.name}...`);
			const product = await stripe.products.create({
				name: plan.name,
				description: plan.description,
				metadata: { planId: String(plan._id) },
			});

			// Create price
			console.log(
				`Creating Stripe price for plan ${plan.name} (${plan.price} ${plan.currency})...`
			);
			const unitAmount = Math.round(plan.price * 100); // cents
			const recurring = { interval: plan.interval };
			const price = await stripe.prices.create({
				product: product.id,
				unit_amount: unitAmount,
				currency: (plan.currency || "usd").toLowerCase(),
				recurring,
			});

			plan.stripeProductId = product.id;
			plan.stripePriceId = price.id;
			await plan.save();

			console.log(`Updated plan ${plan.name} with product=${product.id} price=${price.id}`);
		}

		console.log("Sync complete");
	} catch (err) {
		console.error(err);
	} finally {
		await mongoose.disconnect();
		process.exit(0);
	}
};

run();
