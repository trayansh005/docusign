#!/usr/bin/env node
import dotenv from "dotenv";
dotenv.config();
import mongoose from "mongoose";
import connectDB from "../database/connection.js";
import Plan from "../models/Plan.js";

const argv = process.argv.slice(2);
const args = {};
for (let i = 0; i < argv.length; i++) {
	const a = argv[i];
	if (a.startsWith("--")) {
		const key = a.replace(/^--/, "");
		const val = argv[i + 1];
		args[key] = val;
		i++;
	}
}

const name = args.name || args.n;
const id = args.id;
const priceId = args.priceId || args.p;
const productId = args.productId || args.prod;

if ((!name && !id) || !priceId) {
	console.error(
		"Usage: node scripts/set-plan-stripe.js --name <PlanName> --priceId <price_...> [--productId <prod_...>]\nOr: node scripts/set-plan-stripe.js --id <planId> --priceId <price_...>"
	);
	process.exit(1);
}

const run = async () => {
	try {
		await connectDB();

		let plan;
		if (id) plan = await Plan.findById(id);
		else plan = await Plan.findOne({ name });

		if (!plan) {
			console.error("Plan not found");
			process.exit(1);
		}

		plan.stripePriceId = priceId;
		if (productId) plan.stripeProductId = productId;
		await plan.save();

		console.log(`Updated plan ${plan.name} (${plan._id}) with stripePriceId=${priceId}`);
		await mongoose.disconnect();
		process.exit(0);
	} catch (err) {
		console.error(err);
		process.exit(1);
	}
};

run();
