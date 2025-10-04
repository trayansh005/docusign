import { cookies } from "next/headers";

const backendUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

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
		// Get cookies for server-side request
		const cookieStore = await cookies();
		const cookieHeader = cookieStore.toString();

		const fetchOptions: RequestInit = {
			method,
			headers: {
				"Content-Type": "application/json",
				...headers,
				// Include cookies in server-side request
				...(cookieHeader && { Cookie: cookieHeader }),
			},
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
			throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
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
