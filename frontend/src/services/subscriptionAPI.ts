const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

export interface Subscription {
	_id: string;
	plan: string;
	price: number;
	status: string;
}

export const subscriptionAPI = {
	async getSubscriptions(): Promise<Subscription[]> {
		try {
			const response = await fetch(`${API_BASE_URL}/subscription`, {
				method: "GET",
				credentials: "include",
			});

			if (response.status === 401) {
				// Not authenticated
				window.location.href = "/login";
				throw new Error("Unauthorized");
			}

			if (!response.ok) {
				throw new Error(`Failed to load subscriptions: ${response.status}`);
			}

			const body = await response.json();

			// Accept multiple shapes from the API: array directly, { data: [] }, or { subscriptions: [] }
			let subsArray: Subscription[] = [];
			if (Array.isArray(body)) subsArray = body;
			else if (Array.isArray(body.data)) subsArray = body.data;
			else if (Array.isArray(body.subscriptions)) subsArray = body.subscriptions;
			else subsArray = [];

			return subsArray;
		} catch (error) {
			console.error("Error loading subscriptions:", error);
			throw error;
		}
	},

	async createSubscription(
		plan: string,
		price: number
	): Promise<{ success: boolean; message: string }> {
		try {
			const response = await fetch(`${API_BASE_URL}/subscription`, {
				method: "POST",
				credentials: "include",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ plan, price }),
			});

			if (response.status === 401) {
				window.location.href = "/login";
				throw new Error("Unauthorized");
			}

			const data = await response.json();

			return {
				success: response.ok,
				message: response.ok ? "Subscribed!" : data.message,
			};
		} catch (error) {
			console.error("Error creating subscription:", error);
			throw error;
		}
	},
};
