import { cookies } from "next/headers";
import { getAuthHeaders } from "./serverAuthHeaders";

const backendUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

// Custom error class to preserve error code and data
export class ApiError extends Error {
	public code?: string;
	public data?: unknown;

	constructor(message: string, code?: string, data?: unknown) {
		super(message);
		this.code = code;
		this.data = data;
		Object.setPrototypeOf(this, ApiError.prototype);
	}
}

interface ServerApiOptions {
	method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
	body?: unknown;
	headers?: Record<string, string>;
	cache?: RequestCache;
	revalidate?: number;
	tags?: string[];
}

/**
 * Server-side API client for use in server actions and server components
 * Automatically handles cookie authentication
 */
export async function serverApiClient(endpoint: string, options: ServerApiOptions = {}) {
	const { method = "GET", body, headers = {}, cache, revalidate, tags } = options;

	try {
		// Get authenticated headers
		let authHeaders = {};
		try {
			authHeaders = await getAuthHeaders(headers);
		} catch (e) {
			console.log("[ServerAPI] No auth headers found (unauthenticated request)");
			authHeaders = headers;
		}

		console.log(`[ServerAPI] ${method} ${endpoint}`);
		console.log(`[ServerAPI] Has Authorization:`, !!(authHeaders as any).Authorization);

		const fetchOptions: RequestInit = {
			method,
			headers: {
				"Content-Type": "application/json",
				...authHeaders,
			},
			credentials: 'include',
			...(cache && { cache }),
			...(revalidate !== undefined || tags
				? {
					next: {
						...(revalidate !== undefined && { revalidate }),
						...(tags && { tags }),
					},
				}
				: {}),
		};

		// Add body for non-GET requests
		if (body && method !== "GET") {
			if (body instanceof FormData) {
				// Remove Content-Type for FormData to let browser set boundary
				const headers = fetchOptions.headers as Record<string, string>;
				delete headers["Content-Type"];
				fetchOptions.body = body;
			} else {
				fetchOptions.body = JSON.stringify(body);
			}
		}

		const url = endpoint.startsWith("http") ? endpoint : `${backendUrl}${endpoint}`;
		const response = await fetch(url, fetchOptions);

		if (!response.ok) {
			const errorData = await response
				.json()
				.catch(() => ({ message: "An unknown error occurred" }));
			console.error(`API Error: ${response.status} ${response.statusText}`, errorData);

			// If 401 Unauthorized, it means auth failed - signal to redirect to login
			if (response.status === 401) {
				// Embed special AUTH_REQUIRED marker in error message
				// Client will catch this and redirect to login
				const errorMessage = `AUTH_REQUIRED:${errorData.message || "Authentication required"}`;
				throw new ApiError(errorMessage, "AUTH_REQUIRED", errorData);
			}

			// Embed code in error message to survive server action serialization
			const errorMessage = errorData.code
				? `[${errorData.code}] ${errorData.message || `HTTP ${response.status}: ${response.statusText}`
				}`
				: errorData.message || `HTTP ${response.status}: ${response.statusText}`;

			console.log(
				"[serverApiClient] Error message constructed:",
				errorMessage,
				"Code:",
				errorData.code
			);
			throw new ApiError(errorMessage, errorData.code, errorData);
		}

		// Handle empty responses
		const contentType = response.headers.get("content-type");
		if (contentType?.includes("application/json")) {
			return response.json();
		}

		return response.text();
	} catch (error) {
		console.error("Server API Client Error:", error);
		throw error;
	}
}

/**
 * Convenience methods for common HTTP operations
 */
export const serverApi = {
	get: (endpoint: string, options?: Omit<ServerApiOptions, "method">) =>
		serverApiClient(endpoint, { ...options, method: "GET" }),

	post: (endpoint: string, body?: unknown, options?: Omit<ServerApiOptions, "method" | "body">) =>
		serverApiClient(endpoint, { ...options, method: "POST", body }),

	put: (endpoint: string, body?: unknown, options?: Omit<ServerApiOptions, "method" | "body">) =>
		serverApiClient(endpoint, { ...options, method: "PUT", body }),

	patch: (endpoint: string, body?: unknown, options?: Omit<ServerApiOptions, "method" | "body">) =>
		serverApiClient(endpoint, { ...options, method: "PATCH", body }),

	delete: (endpoint: string, options?: Omit<ServerApiOptions, "method">) =>
		serverApiClient(endpoint, { ...options, method: "DELETE" }),
};
