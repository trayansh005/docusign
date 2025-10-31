const rawBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";
const API_BASE_URL = rawBase.endsWith("/api") ? rawBase : rawBase.replace(/\/$/, "") + "/api";

class ApiClient {
	private baseURL: string;

	constructor(baseURL: string) {
		this.baseURL = baseURL;
	}

	private async makeRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
		const url = `${this.baseURL}${endpoint}`;

		const config: RequestInit = {
			...options,
			headers: {
				"Content-Type": "application/json",
				...options.headers,
			},
			credentials: "include",
		};

		try {
			const response = await fetch(url, config);

			// Handle 401 Unauthorized - session expired or invalid
			if (response.status === 401) {
				const error = new Error("Unauthorized") as Error & { status: number };
				error.status = 401;
				throw error;
			}

			const text = await response.text();
			let data: unknown = null;
			if (text) {
				try {
					data = JSON.parse(text);
				} catch {
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
