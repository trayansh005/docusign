"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Portal } from "@/components/Portal";

type PricingPlan = {
	_id: string;
	name: string;
	price: number;
	interval: "month" | "year";
	description: string;
	features: string[];
	isActive?: boolean;
	popular?: boolean;
	stripePriceId?: string | null;
};

type UserSubscription = {
	_id?: string;
	planId?: { _id?: string; name?: string } | string | null;
	status?: string;
	cancelAtPeriodEnd?: boolean;
	currentPeriodEnd?: string | Date;
};

export default function Pricing() {
	const [billingPeriod, setBillingPeriod] = useState<"month" | "year">("month");
	const [plans, setPlans] = useState<PricingPlan[] | null>(null);
	const [loading, setLoading] = useState(false);
	const [modalOpen, setModalOpen] = useState(false);
	const [modalMessage, setModalMessage] = useState("");
	const [subscribedPlanId, setSubscribedPlanId] = useState<string | null>(null);
	const [currentSubscriptionPlanId, setCurrentSubscriptionPlanId] = useState<string | null>(null);
	const [showCancelModal, setShowCancelModal] = useState(false);
	const [cancelling, setCancelling] = useState(false);
	const [confirmImmediate, setConfirmImmediate] = useState(false);
	const [currentSubscription, setCurrentSubscription] = useState<UserSubscription | null>(null);

	useEffect(() => {
		// Fetch plans from backend
		let mounted = true;
		(async () => {
			try {
				setLoading(true);
				const res = await fetch("/api/subscription/plans");
				if (!mounted) return;
				if (res.ok) {
					const json = await res.json();
					const sortedPlans = (json.plans || []).sort((a: PricingPlan, b: PricingPlan) => {
						// Show Professional plan first
						if (a.name.toLowerCase().includes("professional")) return -1;
						if (b.name.toLowerCase().includes("professional")) return 1;
						return 0;
					});
					setPlans(sortedPlans);
				} else {
					setPlans([]);
				}
			} catch (err) {
				console.error("Failed to load plans", err);
				setPlans([]);
			} finally {
				setLoading(false);
			}
		})();

		return () => {
			mounted = false;
		};
	}, []);

	// Fetch user's current subscription (if logged in)
	useEffect(() => {
		let mounted = true;
		const fetchUserSubscription = async () => {
			try {
				const res = await fetch("/api/subscription/me", {
					method: "GET",
					credentials: "include",
				});
				if (!mounted) return;
				if (res.ok) {
					const json = await res.json();
					const subscription = json.subscription;
					if (mounted) setCurrentSubscription(subscription || null);
					if (subscription) {
						// planId may be populated object or id string
						const planId = subscription.planId?._id || subscription.planId || null;
						setCurrentSubscriptionPlanId(planId ? String(planId) : null);
					} else {
						setCurrentSubscriptionPlanId(null);
					}
				} else {
					// not logged in or no subscription
					setCurrentSubscriptionPlanId(null);
				}
			} catch (err) {
				console.error("Failed to fetch user subscription", err);
			}
		};

		fetchUserSubscription();

		return () => {
			mounted = false;
		};
	}, []);

	// Handle Stripe returning to the page with session_id after Checkout
	const router = useRouter();

	useEffect(() => {
		const params = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
		const sessionId = params.get("session_id");
		if (!sessionId) return;

		const verify = async () => {
			try {
				// Send session id to backend to verify and create subscription
				const res = await fetch("/api/subscription/verify", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					credentials: "include",
					body: JSON.stringify({ sessionId }),
				});

				if (res.status === 401) {
					// Not authenticated - redirect to login and preserve session_id
					const next = encodeURIComponent(`/subscription?session_id=${sessionId}`);
					window.location.href = `/login?next=${next}`;
					return;
				}

				const json = await res.json();
				if (json?.success) {
					// Show success modal and update subscribed plan state
					setModalMessage("Subscription created successfully");
					setModalOpen(true);
					const planIdFromResp = json.subscription?.planId || json.subscription?.plan || null;
					if (planIdFromResp) setSubscribedPlanId(String(planIdFromResp));

					// Update current subscription state immediately
					if (json.subscription) {
						setCurrentSubscription(json.subscription);
						const planId = json.subscription.planId?._id || json.subscription.planId || null;
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
			const res = await fetch("/api/subscription/checkout", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				credentials: "include",
				body: JSON.stringify({ planId }),
			});

			if (res.status === 401) {
				// Not authenticated - redirect to login
				window.location.href = "/login";
				return;
			}

			const json = await res.json();
			if (json?.success && json.url) {
				// Redirect to Stripe Checkout
				window.location.href = json.url;
			} else {
				console.error("Failed to create checkout session", json);
				alert(json?.message || "Unable to start checkout. Try again or contact support.");
			}
		} catch (err) {
			console.error("Error starting checkout:", err);
			alert("Failed to start checkout. Please try again.");
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
					{loading && <div className="text-white">Loading plans...</div>}
					{!loading && (!plans || plans.length === 0) && (
						<div className="text-slate-300">No plans available right now.</div>
					)}

					{!loading &&
						plans &&
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

								{plan.stripePriceId ? (
									// If user already has this plan, show current badge and disabled button
									currentSubscriptionPlanId === plan._id ? (
										<button
											disabled
											className="w-full block text-center py-3 px-6 rounded-lg font-semibold bg-green-600 text-white cursor-not-allowed"
										>
											Current plan
										</button>
									) : (
										<button
											onClick={() => handleSubscribe(plan._id)}
											className={`w-full block text-center py-3 px-6 rounded-lg font-semibold transition-all duration-200 ${
												plan.popular
													? "bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700 shadow-lg hover:shadow-xl"
													: "bg-slate-700 text-white hover:bg-slate-600"
											}`}
										>
											Subscribe
										</button>
									)
								) : (
									<Link
										href={"/register"}
										className={`w-full block text-center py-3 px-6 rounded-lg font-semibold transition-all duration-200 ${
											plan.popular
												? "bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700 shadow-lg hover:shadow-xl"
												: "bg-slate-700 text-white hover:bg-slate-600"
										}`}
									>
										Get Started
									</Link>
								)}

								{/* Subscribed badge if recently subscribed */}
								{subscribedPlanId === plan._id && (
									<div className="absolute top-4 right-4 bg-green-600 text-white px-3 py-1 rounded-full text-sm font-semibold">
										Subscribed
									</div>
								)}
							</div>
						))}
				</div>

				{/* FAQ Section */}
				<div className="mt-20 max-w-4xl mx-auto">
					<h2 className="text-3xl font-bold text-white text-center mb-12">
						Frequently Asked Questions
					</h2>
					<div className="grid md:grid-cols-2 gap-8">
						<div className="bg-slate-800/30 rounded-lg p-6">
							<h3 className="text-lg font-semibold text-white mb-3">Can I change plans anytime?</h3>
							<p className="text-slate-300">
								Yes, you can upgrade or downgrade your plan at any time. Changes take effect
								immediately.
							</p>
						</div>
						<div className="bg-slate-800/30 rounded-lg p-6">
							<h3 className="text-lg font-semibold text-white mb-3">
								What payment methods do you accept?
							</h3>
							<p className="text-slate-300">
								We accept all major credit cards, PayPal, and bank transfers for Enterprise plans.
							</p>
						</div>
						<div className="bg-slate-800/30 rounded-lg p-6">
							<h3 className="text-lg font-semibold text-white mb-3">Do you offer refunds?</h3>
							<p className="text-slate-300">
								We offer a 30-day money-back guarantee on all paid plans. Contact support for
								assistance.
							</p>
						</div>
						<div className="bg-slate-800/30 rounded-lg p-6">
							<h3 className="text-lg font-semibold text-white mb-3">Do you offer refunds?</h3>
							<p className="text-slate-300">
								We offer a 30-day money-back guarantee on all paid plans. Contact support for
								assistance.
							</p>
						</div>
					</div>
				</div>

				{/* CTA Section */}
				<div className="mt-20 text-center">
					<div className="bg-gradient-to-r from-blue-600/20 to-purple-600/20 rounded-2xl p-8 border border-blue-500/30">
						<h2 className="text-3xl font-bold text-white mb-4">Ready to get started?</h2>
						<p className="text-slate-300 mb-6 max-w-2xl mx-auto">
							Join thousands of businesses already using FomiqSign to streamline their document
							workflows.
						</p>
						<div className="flex flex-col sm:flex-row gap-4 justify-center">
							<Link
								href="/register"
								className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-8 py-3 rounded-lg font-semibold hover:from-blue-700 hover:to-purple-700 transition-all duration-200"
							>
								Get Started
							</Link>
							<Link
								href="/login"
								className="bg-slate-700 text-white px-8 py-3 rounded-lg font-semibold hover:bg-slate-600 transition-all duration-200"
							>
								Sign In
							</Link>
						</div>
					</div>
				</div>
			</div>

			{/* Manage current subscription (cancel) */}
			{currentSubscription && (
				<div className="mt-8 max-w-2xl mx-auto bg-slate-800/40 rounded-lg p-6">
					<h3 className="text-xl font-semibold text-white mb-2">Your current subscription</h3>
					{(() => {
						const pid = currentSubscription.planId;
						let planName: string | undefined;
						if (pid && typeof pid === "object" && "name" in pid) {
							planName = (pid as { name?: string }).name;
						}
						return <p className="text-slate-300 mb-4">Plan: {planName || "N/A"}</p>;
					})()}
					<div className="flex gap-2 justify-center">
						<button
							className="px-4 py-2 bg-red-600 text-white rounded-md"
							onClick={() => setShowCancelModal(true)}
						>
							Cancel subscription
						</button>
					</div>
				</div>
			)}
			{/* Modal */}
			{modalOpen && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
					<div className="bg-white dark:bg-slate-800 rounded-lg p-6 max-w-md w-full">
						<h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
							Subscription
						</h3>
						<p className="text-slate-700 dark:text-slate-300 mb-6">{modalMessage}</p>
						<div className="text-right">
							<button
								className="px-4 py-2 bg-blue-600 text-white rounded-md"
								onClick={() => setModalOpen(false)}
							>
								Close
							</button>
						</div>
					</div>
				</div>
			)}

			{/* Cancel Modal for managing subscription */}
			{showCancelModal && (
				<Portal>
					<div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50">
						<div className="bg-white dark:bg-slate-800 rounded-lg p-6 max-w-md w-full shadow-2xl">
							<h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
								Cancel subscription
							</h3>
							<p className="text-sm text-slate-700 dark:text-slate-300 mb-4">
								Choose how you&apos;d like to cancel. &quot;At period end&quot; will keep access
								until your next billing date. &quot;Immediate&quot; will stop access now and may
								require refunds per policy.
							</p>
							<div className="space-y-3">
								{confirmImmediate && (
									<p className="text-sm text-red-500">Confirm immediate cancellation?</p>
								)}
								<div className="flex gap-2 justify-end flex-wrap">
									<button
										className="px-4 py-2 bg-yellow-500 text-black rounded-md"
										onClick={async () => {
											setCancelling(true);
											try {
												const res = await fetch("/api/subscription/cancel", {
													method: "POST",
													headers: { "Content-Type": "application/json" },
													credentials: "include",
													body: JSON.stringify({ mode: "at_period_end" }),
												});
												if (res.ok) {
													setShowCancelModal(false);
													const refreshed = await fetch("/api/subscription/me", {
														credentials: "include",
													});
													if (refreshed.ok) {
														const json = await refreshed.json();
														setCurrentSubscription(json.subscription);
													}
												}
											} catch (err) {
												console.error("Failed to cancel subscription (at period end):", err);
												alert("Failed to cancel subscription. Try again or contact support.");
											} finally {
												setCancelling(false);
											}
										}}
									>
										Cancel at period end
									</button>
									{!confirmImmediate ? (
										<button
											className="px-4 py-2 bg-red-600 text-white rounded-md"
											onClick={() => setConfirmImmediate(true)}
										>
											Cancel immediately
										</button>
									) : (
										<>
											<button
												className="px-3 py-2 bg-red-700 text-white rounded-md"
												onClick={async () => {
													setCancelling(true);
													try {
														const res = await fetch("/api/subscription/cancel", {
															method: "POST",
															headers: { "Content-Type": "application/json" },
															credentials: "include",
															body: JSON.stringify({ mode: "immediate" }),
														});
														if (res.ok) {
															setShowCancelModal(false);
															setConfirmImmediate(false);
															const refreshed = await fetch("/api/subscription/me", {
																credentials: "include",
															});
															if (refreshed.ok) {
																const json = await refreshed.json();
																setCurrentSubscription(json.subscription);
															}
														}
													} catch (err) {
														console.error("Failed to cancel subscription immediately:", err);
														alert("Failed to cancel subscription. Try again or contact support.");
													} finally {
														setCancelling(false);
													}
												}}
											>
												Yes, cancel now
											</button>
											<button
												className="px-3 py-2 bg-gray-200 text-black rounded-md"
												onClick={() => setConfirmImmediate(false)}
											>
												No, go back
											</button>
										</>
									)}
									<button
										className="px-4 py-2 bg-gray-200 text-black rounded-md"
										onClick={() => {
											setShowCancelModal(false);
											setConfirmImmediate(false);
										}}
										disabled={cancelling}
									>
										Close
									</button>
								</div>
							</div>
						</div>
					</div>
				</Portal>
			)}
		</div>
	);
}
