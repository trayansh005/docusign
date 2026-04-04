const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:5002/api").replace(/\/$/, "");

class ApiClient {
	private baseURL: string;
	private isRefreshing = false;

	constructor(baseURL: string) {
		this.baseURL = baseURL;
	}

	private async makeRequest<T>(endpoint: string, options: RequestInit = {}, retry = true): Promise<T> {
		const url = `${this.baseURL}${endpoint}`;

		const config: RequestInit = {
			...options,
			headers: { "Content-Type": "application/json", ...options.headers },
			credentials: "include",
		};

		const response = await fetch(url, config);

		if (response.status === 401 && retry) {
			let body: { needsRefresh?: boolean } = {};
			try { body = await response.clone().json(); } catch { /* ignore */ }

			if (body.needsRefresh && !this.isRefreshing) {
				// Try to refresh the access token
				this.isRefreshing = true;
				try {
					const refreshRes = await fetch(`${this.baseURL}/auth/refresh`, {
						method: "POST",
						credentials: "include",
					});
					this.isRefreshing = false;

					if (refreshRes.ok) {
						// Retry original request with new token
						return this.makeRequest<T>(endpoint, options, false);
					}
				} catch {
					this.isRefreshing = false;
				}
			}

			// Refresh failed or not needed — clear state and redirect
			const { useAuthStore } = await import("@/stores/authStore");
			useAuthStore.getState().clearUser();
			if (typeof window !== "undefined") {
				window.location.href = `/login?redirect=${encodeURIComponent(window.location.pathname)}`;
			}
			const error = new Error("Unauthorized") as Error & { status: number };
			error.status = 401;
			throw error;
		}

		const text = await response.text();
		if (!text) return null as T;

		try {
			return JSON.parse(text) as T;
		} catch {
			throw new Error(`Expected JSON but got: ${text.slice(0, 200)}`);
		}
	}

	async get<T>(endpoint: string, options?: RequestInit): Promise<T> {
		return this.makeRequest<T>(endpoint, { ...options, method: "GET" });
	}

	async post<T>(endpoint: string, body?: unknown, options?: RequestInit): Promise<T> {
		return this.makeRequest<T>(endpoint, {
			...options,
			method: "POST",
			body: body ? JSON.stringify(body) : undefined,
		});
	}

	async put<T>(endpoint: string, body?: unknown, options?: RequestInit): Promise<T> {
		return this.makeRequest<T>(endpoint, {
			...options,
			method: "PUT",
			body: body ? JSON.stringify(body) : undefined,
		});
	}

	async delete<T>(endpoint: string, options?: RequestInit): Promise<T> {
		return this.makeRequest<T>(endpoint, { ...options, method: "DELETE" });
	}
}

const apiClient = new ApiClient(API_BASE_URL);
export default apiClient;
