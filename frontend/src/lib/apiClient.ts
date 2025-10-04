import { tokenUtils } from "./tokenUtils";

// Ensure API base URL always points to the backend API root (include /api).
const rawBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";
const API_BASE_URL = rawBase.endsWith("/api") ? rawBase : rawBase.replace(/\/$/, "") + "/api";

class ApiClient {
	private baseURL: string;

	constructor(baseURL: string) {
		this.baseURL = baseURL;
	}

	private async makeRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
		const url = `${this.baseURL}${endpoint}`;
		const accessToken = tokenUtils.getAccessToken();

		const config: RequestInit = {
			...options,
			headers: {
				"Content-Type": "application/json",
				...(accessToken && { Authorization: `Bearer ${accessToken}` }),
				...options.headers,
			},
			credentials: "include", // Important for cookies
		};

		try {
			let response = await fetch(url, config);

			// Handle token refresh on 401
			if (response.status === 401 && accessToken) {
				const refreshToken = tokenUtils.getRefreshToken();
				if (refreshToken) {
					const refreshResult = await tokenUtils.refreshAccessToken(refreshToken);
					if (refreshResult.accessToken && refreshResult.refreshToken) {
						tokenUtils.setTokens(refreshResult.accessToken, refreshResult.refreshToken);

						// Retry the original request with new token
						config.headers = {
							...config.headers,
							Authorization: `Bearer ${refreshResult.accessToken}`,
						};
						response = await fetch(url, config);
					} else {
						// Refresh failed, clear tokens and redirect to login
						tokenUtils.clearTokens();
						if (typeof window !== "undefined") {
							window.location.href = "/login";
						}
						throw new Error("Authentication failed");
					}
				}
			}

			// Read text first so we can give a helpful error message when the server returns HTML (e.g. an index.html)
			const text = await response.text();
			let data: unknown = null;
			if (text) {
				try {
					data = JSON.parse(text);
				} catch {
					// Received non-JSON (probably HTML). Surface a clear error rather than crashing on JSON.parse
					const snippet = text.slice(0, 200).replace(/\s+/g, " ");
					const msg = `Expected JSON response but received non-JSON (status ${response.status}). Response start: ${snippet}`;
					throw new Error(msg);
				}
			}

			return data as T;
		} catch (error) {
			console.error("API request failed:", error);
			throw error;
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
