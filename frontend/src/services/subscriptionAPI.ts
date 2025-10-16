"use server";

import { serverApi } from "@/lib/serverApiClient";
import { ApiError } from "@/lib/serverApiClient";

export interface Subscription {
	_id: string;
	plan: string;
	price: number;
	status: string;
}

export interface PricingPlan {
	_id: string;
	name: string;
	price: number;
	interval: "month" | "year";
	description: string;
	features: string[];
	isActive?: boolean;
	popular?: boolean;
	stripePriceId?: string | null;
}

export interface UserSubscription {
	_id?: string;
	planId?: { _id?: string; name?: string } | string | null;
	status?: string;
	cancelAtPeriodEnd?: boolean;
	currentPeriodEnd?: string | Date;
}

export async function getPricingPlans(): Promise<PricingPlan[]> {
	const result = await serverApi.get("/subscription/plans");
	const plans = result.plans || [];

	// Sort with Professional plan first
	return plans.sort((a: PricingPlan, b: PricingPlan) => {
		if (a.name.toLowerCase().includes("professional")) return -1;
		if (b.name.toLowerCase().includes("professional")) return 1;
		return 0;
	});
}

export async function getUserSubscription(): Promise<UserSubscription | null> {
	try {
		const result = await serverApi.get("/subscription/me");
		return result.subscription || null;
	} catch (error) {
		if (
			error instanceof ApiError &&
			(error.message.includes("401") || error.message.includes("Unauthorized"))
		) {
			return null;
		}
		throw error;
	}
}

export async function getSubscriptions(): Promise<Subscription[]> {
	const result = await serverApi.get("/subscription");

	// Accept multiple shapes from the API: array directly, { data: [] }, or { subscriptions: [] }
	let subsArray: Subscription[] = [];
	if (Array.isArray(result)) subsArray = result;
	else if (Array.isArray(result.data)) subsArray = result.data;
	else if (Array.isArray(result.subscriptions)) subsArray = result.subscriptions;
	else subsArray = [];

	return subsArray;
}

export async function createSubscription(
	plan: string,
	price: number
): Promise<{ success: boolean; message: string }> {
	await serverApi.post("/subscription", { plan, price });

	return {
		success: true,
		message: "Subscribed!",
	};
}

export async function createCheckoutSession(planId: string) {
	return await serverApi.post("/subscription/checkout", { planId });
}

export async function verifySession(sessionId: string) {
	return await serverApi.post("/subscription/verify", { sessionId });
}

export async function cancelSubscription(subscriptionId: string, cancelImmediately?: boolean) {
	const body = cancelImmediately ? { cancelImmediately } : undefined;
	return await serverApi.delete(`/subscription/${subscriptionId}`, { body });
}
