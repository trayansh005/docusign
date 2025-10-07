"use client";

import { useState, useEffect } from "react";
import { subscriptionAPI, type Subscription } from "@/services/subscriptionAPI";

export default function Subscription() {
	const [plan, setPlan] = useState("");
	const [price, setPrice] = useState("");
	const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
	const [message, setMessage] = useState("");

	useEffect(() => {
		// Try to load subscriptions using cookies (httpOnly access token)
		loadSubscriptions();
	}, []);

	const loadSubscriptions = async () => {
		try {
			const subsArray = await subscriptionAPI.getSubscriptions();
			setSubscriptions(subsArray);
		} catch (err) {
			console.error("Error loading subscriptions:", err);
			setSubscriptions([]);
		}
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		try {
			const result = await subscriptionAPI.createSubscription(plan, parseFloat(price));
			setMessage(result.message);
			if (result.success) {
				await loadSubscriptions();
			}
		} catch (error) {
			console.error("Error creating subscription:", error);
			setMessage("Error creating subscription");
		}
	};

	return (
		<div className="min-h-screen bg-gradient-main flex items-center justify-center py-10 px-4">
			<div className="card w-full max-w-2xl">
				<div className="p-8">
					<div className="text-center mb-8">
						<h1 className="text-3xl font-bold text-white mb-2">Subscriptions</h1>
						<p className="text-white/70">Manage your FomiqSign integration plans</p>
					</div>

					<form onSubmit={handleSubmit} className="mb-8 space-y-6">
						<div>
							<input
								type="text"
								placeholder="Plan (e.g., basic, premium)"
								value={plan}
								onChange={(e) => setPlan(e.target.value)}
								className="form-input w-full"
								required
							/>
						</div>
						<div>
							<input
								type="number"
								placeholder="Price"
								value={price}
								onChange={(e) => setPrice(e.target.value)}
								className="form-input w-full"
								required
							/>
						</div>
						<button type="submit" className="btn btn-primary w-full">
							Subscribe
						</button>
					</form>

					<div>
						<h2 className="text-2xl font-semibold mb-4 text-white">Your Subscriptions</h2>
						{subscriptions.length === 0 ? (
							<div className="card-secondary p-6 text-center">
								<p className="text-white/70">No subscriptions found.</p>
							</div>
						) : (
							<div className="space-y-4">
								{subscriptions.map((sub) => (
									<div key={sub._id} className="card-secondary p-4">
										<div className="flex justify-between items-center">
											<div>
												<h3 className="text-lg font-semibold text-white capitalize">{sub.plan}</h3>
												<p className="text-white/70">
													Status: <span className="capitalize">{sub.status}</span>
												</p>
											</div>
											<div className="text-right">
												<p className="text-2xl font-bold text-blue-400">${sub.price}</p>
											</div>
										</div>
									</div>
								))}
							</div>
						)}
					</div>

					{message && (
						<div className="mt-6 p-4 bg-blue-600/20 border border-blue-500/30 rounded-lg">
							<p className="text-center text-blue-400">{message}</p>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
