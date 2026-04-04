import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import SubscriptionClient from "./SubscriptionClient";
import {
	PricingPlan,
	UserSubscription,
	getPricingPlans,
	getUserSubscription,
} from "@/services/subscriptionAPI";

// Mark this page as dynamic since it uses server-side authentication
export const dynamic = "force-dynamic";

async function fetchPricingPlans(): Promise<PricingPlan[]> {
	try {
		return await getPricingPlans();
	} catch (error) {
		console.error("Error loading pricing plans:", error);
		return [];
	}
}

async function fetchUserSubscription(): Promise<UserSubscription | null> {
	try {
		return await getUserSubscription();
	} catch (error) {
		console.error("Error loading user subscription:", error);
		return null;
	}
}

export default async function Subscription() {
	const queryClient = new QueryClient();

	// Prefetch plans and user subscription
	const [plans, subscription] = await Promise.all([fetchPricingPlans(), fetchUserSubscription()]);

	return (
		<HydrationBoundary state={dehydrate(queryClient)}>
			<SubscriptionClient initialPlans={plans} initialSubscription={subscription} />
		</HydrationBoundary>
	);
}
