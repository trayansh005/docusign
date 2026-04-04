"use server";

import { revalidatePath } from "next/cache";
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
	const result = await serverApi.get("/subscription/plans", { tags: ["plans"] });
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
		// Tag this fetch so it can be invalidated with updateTag/revalidateTag
		const result = await serverApi.get("/subscription/me", { tags: ["subscription"] });
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
	const result = await serverApi.delete(`/subscription/${subscriptionId}`, { body });

	// Prefer using updateTag (read-your-own-writes) when available (Next.js 16+).
	// Fallback to revalidatePath for older Next versions.
	try {
		// Dynamically import `updateTag` when available (Next.js 16+). Using dynamic
		// import avoids TypeScript/compile errors on older Next versions that don't
		// export `updateTag` from 'next/cache'.
		const cacheMod = await import("next/cache");
		const updateTagFn = (cacheMod as unknown as { updateTag?: (tag: string) => void }).updateTag;
		if (typeof updateTagFn === "function") {
			updateTagFn("subscription");
		} else {
			revalidatePath("/subscription");
		}
	} catch (err) {
		// Non-fatal: don't block cancel operation if cache APIs are unavailable
		console.warn("Failed to update subscription cache tag/path:", err);
	}

	return result;
}
