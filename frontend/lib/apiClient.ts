import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from "axios";
import { getAccessToken } from "@/lib/authClient";

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:5002/api").replace(/\/$/, "");

/**
 * We define a custom interface for our ApiClient to ensure TypeScript 
 * knows that our methods return the 'data' field directly (T) 
 * instead of the full 'AxiosResponse<T>'.
 */
export interface CustomApiClient {
	get<T = any>(url: string, config?: AxiosRequestConfig): Promise<T>;
	post<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T>;
	put<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T>;
	patch<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T>;
	delete<T = any>(url: string, config?: AxiosRequestConfig): Promise<T>;
	// Allow access to the underlying instance if needed
	instance: AxiosInstance;
}

const instance = axios.create({
	baseURL: API_BASE_URL,
	withCredentials: true,
	headers: {
		"Content-Type": "application/json",
		Accept: "application/json",
	},
});

const PROTECTED_PATH_PREFIXES = ["/dashboard", "/profile", "/settings", "/fomiqsign"];

function shouldRedirectOnUnauthorized(pathname: string) {
	if (pathname.startsWith("/login") || pathname.startsWith("/register")) {
		return false;
	}

	return PROTECTED_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

instance.interceptors.request.use((config) => {
	if (config.data instanceof FormData) {
		if (config.headers.delete) {
			config.headers.delete("Content-Type");
		} else {
			delete config.headers["Content-Type"];
			delete config.headers["content-type"];
		}
	}
	// Attach Bearer token from frontend-owned cookie
	if (typeof window !== "undefined") {
		const token = getAccessToken();
		if (token) {
			config.headers.Authorization = `Bearer ${token}`;
		}
	}
	return config;
});

instance.interceptors.response.use(
	(response) => {
		const data = response.data;

		// The backend already sets httpOnly auth cookies (accessToken, refreshToken).
		// We avoid setting them manually here to prevent duplicates and maintain security.
		return response;
	},
	(error) => {
		if (
			error.response?.status === 401 &&
			typeof window !== "undefined" &&
			shouldRedirectOnUnauthorized(window.location.pathname)
		) {
			window.location.href = `/login?redirect=${encodeURIComponent(window.location.pathname)}`;
		}
		return Promise.reject(error);
	},
);

const apiClient: CustomApiClient = {
	get: async <T>(url: string, config?: AxiosRequestConfig) => {
		const response = await instance.get<T>(url, config);
		return response.data;
	},
	post: async <T>(url: string, data?: any, config?: AxiosRequestConfig) => {
		const response = await instance.post<T>(url, data, config);
		return response.data;
	},
	put: async <T>(url: string, data?: any, config?: AxiosRequestConfig) => {
		const response = await instance.put<T>(url, data, config);
		return response.data;
	},
	patch: async <T>(url: string, data?: any, config?: AxiosRequestConfig) => {
		const response = await instance.patch<T>(url, data, config);
		return response.data;
	},
	delete: async <T>(url: string, config?: AxiosRequestConfig) => {
		const response = await instance.delete<T>(url, config);
		return response.data;
	},
	instance: instance
};

export default apiClient;
export { instance };
