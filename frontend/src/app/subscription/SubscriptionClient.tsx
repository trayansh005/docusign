"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Portal } from "@/components/Portal";
import {
	PricingPlan,
	UserSubscription,
	createCheckoutSession,
	verifySession,
	cancelSubscription,
} from "@/services/subscriptionAPI";

interface SubscriptionClientProps {
	initialPlans: PricingPlan[];
	initialSubscription: UserSubscription | null;
}

export default function SubscriptionClient({
	initialPlans,
	initialSubscription,
}: SubscriptionClientProps) {
	const [billingPeriod, setBillingPeriod] = useState<"month" | "year">("month");
	const [plans] = useState<PricingPlan[]>(initialPlans);
	const [modalOpen, setModalOpen] = useState(false);
	const [modalMessage, setModalMessage] = useState("");
	const [subscribedPlanId, setSubscribedPlanId] = useState<string | null>(null);
	const [currentSubscriptionPlanId, setCurrentSubscriptionPlanId] = useState<string | null>(null);
	const [showCancelModal, setShowCancelModal] = useState(false);
	const [cancelling, setCancelling] = useState(false);
	const [confirmImmediate, setConfirmImmediate] = useState(false);
	const [currentSubscription, setCurrentSubscription] = useState<UserSubscription | null>(
		initialSubscription
	);

	// Initialize subscription plan ID from initial data
	useEffect(() => {
		if (initialSubscription) {
			const planId =
				(typeof initialSubscription.planId === "object" && initialSubscription.planId?._id) ||
				(typeof initialSubscription.planId === "string" ? initialSubscription.planId : null);
			setCurrentSubscriptionPlanId(planId ? String(planId) : null);
		}
	}, [initialSubscription]);

	// Handle Stripe returning to the page with session_id after Checkout
	const router = useRouter();

	useEffect(() => {
		const params = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
		const sessionId = params.get("session_id");
		if (!sessionId) return;

		const verify = async () => {
			try {
				// Send session id to backend to verify and create subscription
				const json = await verifySession(sessionId);

				if (json?.success) {
					// Show success modal and update subscribed plan state
					setModalMessage("Subscription created successfully");
					setModalOpen(true);
					const planIdFromResp = json.subscription?.planId || json.subscription?.plan || null;
					if (planIdFromResp) setSubscribedPlanId(String(planIdFromResp));

					// Update current subscription state immediately
					if (json.subscription) {
						setCurrentSubscription(json.subscription);
						const planId =
							(typeof json.subscription.planId === "object" && json.subscription.planId?._id) ||
							(typeof json.subscription.planId === "string" ? json.subscription.planId : null);
						setCurrentSubscriptionPlanId(planId ? String(planId) : null);
					}

					// Revalidate server data / refresh app router
					router.refresh();
				} else if (json?.alreadyExists) {
					setModalMessage("You already have an active subscription");
					setModalOpen(true);
				} else {
					console.error("verifySession returned:", json);
					setModalMessage(json?.message || "Subscription verification failed. Contact support.");
					setModalOpen(true);
				}
			} catch (err) {
				console.error("Error verifying session:", err);
				if (err instanceof Error && err.message.includes("401")) {
					// Not authenticated - redirect to login and preserve session_id
					const next = encodeURIComponent(`/subscription?session_id=${sessionId}`);
					window.location.href = `/login?next=${next}`;
					return;
				}
				alert("Failed to verify session. Try refreshing the page or contact support.");
			} finally {
				// Remove session_id from URL to avoid reprocessing
				try {
					const url = new URL(window.location.href);
					url.searchParams.delete("session_id");
					// Use replaceState so user doesn't go back to the same query
					router.replace(url.pathname + url.search + url.hash);
				} catch {
					// fallback: simple redirect to subscription without params
					router.replace("/subscription");
				}
			}
		};

		verify();
	}, [router]);

	const handleSubscribe = async (planId: string) => {
		try {
			// Create Checkout session on backend. Backend expects authentication (cookie or token).
			const json = await createCheckoutSession(planId);
			if (json?.url) {
				// Redirect to Stripe Checkout
				window.location.href = json.url;
			} else {
				console.error("Failed to create checkout session", json);
				alert(json?.message || "Unable to start checkout. Try again or contact support.");
			}
		} catch (err) {
			console.error("Error starting checkout:", err);
			if (err instanceof Error && err.message.includes("401")) {
				// Not authenticated - redirect to login
				window.location.href = "/login";
				return;
			}
			alert("Failed to start checkout. Please try again.");
		}
	};

	const handleCancelSubscription = async () => {
		if (!currentSubscription?._id) return;

		try {
			setCancelling(true);
			const json = await cancelSubscription(currentSubscription._id, confirmImmediate);

			setModalMessage(
				confirmImmediate
					? "Subscription cancelled immediately"
					: "Subscription will be cancelled at the end of billing period"
			);
			setModalOpen(true);
			setShowCancelModal(false);

			// Update current subscription state
			setCurrentSubscription(json.subscription || null);
			const planId =
				(typeof json.subscription?.planId === "object" && json.subscription?.planId?._id) ||
				(typeof json.subscription?.planId === "string" ? json.subscription?.planId : null);
			setCurrentSubscriptionPlanId(planId ? String(planId) : null);

			// Refresh the page to update subscription status
			router.refresh();
		} catch (err) {
			console.error("Error cancelling subscription:", err);
			alert(
				err instanceof Error ? err.message : "Failed to cancel subscription. Please try again."
			);
		} finally {
			setCancelling(false);
		}
	};

	return (
		<div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
			{/* Header */}
			<div className="container mx-auto px-4 py-16">
				<div className="text-center mb-16">
					<h1 className="text-5xl font-bold text-white mb-6">Choose Your Plan</h1>
					<p className="text-xl text-slate-300 max-w-2xl mx-auto mb-8">
						Choose the perfect plan for your document signing needs. All plans include our core
						features with different usage limits.
					</p>

					{/* Billing Toggle */}
					<div className="inline-flex items-center bg-slate-800/50 rounded-lg p-1 mb-8">
						<button
							onClick={() => setBillingPeriod("month")}
							className={`px-6 py-2 rounded-md text-sm font-medium transition-all ${
								billingPeriod === "month"
									? "bg-blue-600 text-white shadow-lg"
									: "text-slate-300 hover:text-white"
							}`}
						>
							Monthly
						</button>
						<button
							onClick={() => setBillingPeriod("year")}
							className={`px-6 py-2 rounded-md text-sm font-medium transition-all ${
								billingPeriod === "year"
									? "bg-blue-600 text-white shadow-lg"
									: "text-slate-300 hover:text-white"
							}`}
						>
							Yearly
							<span className="ml-2 text-xs bg-green-600 text-white px-2 py-1 rounded-full">
								Save 20%
							</span>
						</button>
					</div>
				</div>

				{/* Pricing Cards */}
				<div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
					{(!plans || plans.length === 0) && (
						<div className="text-slate-300">No plans available right now.</div>
					)}

					{plans &&
						plans.map((plan) => (
							<div
								key={plan._id}
								className={`relative bg-slate-800/50 backdrop-blur-sm rounded-2xl p-8 border transition-all duration-300 hover:scale-105 ${
									plan.popular
										? "border-blue-500 shadow-2xl shadow-blue-500/25"
										: "border-slate-700 hover:border-slate-600"
								}`}
							>
								{plan.popular && (
									<div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
										<span className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 py-2 rounded-full text-sm font-semibold">
											Most Popular
										</span>
									</div>
								)}

								<div className="text-center mb-8">
									<h3 className="text-2xl font-bold text-white mb-2">{plan.name}</h3>
									<p className="text-slate-400 mb-4">{plan.description}</p>

									<div className="mb-4">
										<span className="text-5xl font-bold text-white">
											${billingPeriod === "year" ? Math.floor(plan.price * 0.8 * 12) : plan.price}
										</span>
										{plan.price > 0 && (
											<span className="text-slate-400 text-lg">
												/{billingPeriod === "year" ? "year" : plan.interval}
											</span>
										)}
									</div>
								</div>

								<ul className="space-y-4 mb-8">
									{plan.features.map((feature, featureIndex) => (
										<li key={featureIndex} className="flex items-center text-slate-300">
											<svg
												className="w-5 h-5 text-green-400 mr-3 flex-shrink-0"
												fill="currentColor"
												viewBox="0 0 20 20"
											>
												<path
													fillRule="evenodd"
													d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
													clipRule="evenodd"
												/>
											</svg>
											{feature}
										</li>
									))}
								</ul>

								{currentSubscriptionPlanId === plan._id ? (
									<div className="space-y-3">
										<div className="text-center text-green-400 font-semibold">Current Plan</div>
										{currentSubscription?.cancelAtPeriodEnd && (
											<p className="text-xs text-center text-yellow-300">
												Cancellation scheduled for{" "}
												{currentSubscription.currentPeriodEnd
													? new Date(currentSubscription.currentPeriodEnd).toLocaleDateString()
													: "end of billing period"}
											</p>
										)}
										<button
											onClick={() => setShowCancelModal(true)}
											className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
										>
											Cancel Subscription
										</button>
									</div>
								) : (
									<button
										onClick={() => handleSubscribe(plan._id)}
										className={`w-full font-semibold py-3 px-6 rounded-lg transition-colors ${
											plan.popular
												? "bg-blue-600 hover:bg-blue-700 text-white"
												: "border border-slate-600 text-slate-300 hover:border-blue-500 hover:text-blue-400"
										}`}
									>
										{currentSubscriptionPlanId ? "Switch Plan" : "Get Started"}
									</button>
								)}
							</div>
						))}
				</div>
			</div>

			{/* Cancel Subscription Modal */}
			{showCancelModal && (
				<Portal>
					<div
						className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
						onClick={() => setShowCancelModal(false)}
					>
						<div
							className="bg-slate-800 rounded-lg p-8 max-w-md w-full mx-4"
							onClick={(e) => e.stopPropagation()}
						>
							<h2 className="text-2xl font-bold text-white mb-4">Cancel Subscription</h2>
							<p className="text-slate-300 mb-6">
								Are you sure you want to cancel your subscription?
							</p>

							<div className="space-y-4 mb-6">
								<label className="flex items-center text-slate-300">
									<input
										type="checkbox"
										checked={confirmImmediate}
										onChange={(e) => setConfirmImmediate(e.target.checked)}
										className="mr-3 w-4 h-4"
									/>
									Cancel immediately
								</label>
								<p className="text-xs text-slate-400 ml-7">
									{confirmImmediate
										? "Your subscription will end right away. You'll lose access to premium features."
										: "Your subscription will end at the end of your current billing period."}
								</p>
							</div>

							<div className="flex gap-4">
								<button
									onClick={() => setShowCancelModal(false)}
									className="flex-1 px-4 py-2 text-slate-300 border border-slate-600 rounded-lg hover:border-slate-500"
								>
									Keep Subscription
								</button>
								<button
									onClick={handleCancelSubscription}
									disabled={cancelling}
									className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
								>
									{cancelling ? "Cancelling..." : "Cancel"}
								</button>
							</div>
						</div>
					</div>
				</Portal>
			)}

			{/* Success/Info Modal */}
			{modalOpen && (
				<Portal>
					<div
						className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
						onClick={() => setModalOpen(false)}
					>
						<div
							className="bg-slate-800 rounded-lg p-8 max-w-md w-full mx-4"
							onClick={(e) => e.stopPropagation()}
						>
							<h2 className="text-2xl font-bold text-white mb-4">
								{subscribedPlanId ? "Success!" : "Information"}
							</h2>
							<p className="text-slate-300 mb-6">{modalMessage}</p>
							<button
								onClick={() => setModalOpen(false)}
								className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
							>
								Close
							</button>
						</div>
					</div>
				</Portal>
			)}
		</div>
	);
}
