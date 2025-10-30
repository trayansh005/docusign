// Token management utilities
export const TOKEN_STORAGE_KEY = "accessToken";
export const USER_STORAGE_KEY = "user";

// Track ongoing refresh request to prevent race conditions
let refreshPromise: Promise<{ accessToken?: string; error?: string }> | null = null;

export const tokenUtils = {
	// Get token from localStorage
	getAccessToken: (): string | null => {
		if (typeof window === "undefined") return null;
		return localStorage.getItem(TOKEN_STORAGE_KEY);
	},

	// NOTE: refresh token is stored as an httpOnly cookie by the backend and is not readable from JS.
	// No JS storage/accessors are provided for refresh tokens in a cookie-first flow.

	// Set access token in localStorage. Refresh token is httpOnly cookie and should not be stored in JS.
	setTokens: (accessToken: string): void => {
		if (typeof window === "undefined") return;
		localStorage.setItem(TOKEN_STORAGE_KEY, accessToken);
	},

	// Remove tokens from localStorage (httpOnly refresh cookie will be cleared by backend on logout)
	clearTokens: (): void => {
		if (typeof window === "undefined") return;
		localStorage.removeItem(TOKEN_STORAGE_KEY);
		localStorage.removeItem(USER_STORAGE_KEY);
	},

	// Get user from localStorage
	getStoredUser: (): Record<string, unknown> | null => {
		if (typeof window === "undefined") return null;
		const userStr = localStorage.getItem(USER_STORAGE_KEY);
		if (!userStr) return null;
		try {
			return JSON.parse(userStr);
		} catch {
			return null;
		}
	},

	// Set user in localStorage
	setStoredUser: (user: Record<string, unknown>): void => {
		if (typeof window === "undefined") return;
		localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
	},

	// Check if token is expired (basic check - you might want to decode JWT)
	isTokenExpired: (token: string): boolean => {
		if (!token) return true;
		try {
			const payload = JSON.parse(atob(token.split(".")[1]));
			const exp = payload.exp * 1000; // Convert to milliseconds
			return Date.now() >= exp;
		} catch {
			return true;
		}
	},

	// Refresh token API call. Refresh token is stored as httpOnly cookie; frontend should not send it in the body.
	// Returns only the new access token (if successful).
	refreshAccessToken: async (): Promise<{ accessToken?: string; error?: string }> => {
		if (refreshPromise) {
			console.log("Refresh already in progress, waiting for existing request...");
			return refreshPromise;
		}

		refreshPromise = (async () => {
			try {
				const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";
				const response = await fetch(`${apiBase}/auth/refresh-token`, {
					method: "POST",
					credentials: "include", // Important so browser sends httpOnly refresh cookie
				});

				if (!response.ok) {
					if (response.status === 401) return { error: "Refresh token expired or invalid" };
					if (response.status >= 500) return { error: "Server error during token refresh" };
				}

				const data = await response.json();
				if (response.ok && data.success) {
					return { accessToken: data.data.accessToken };
				}
				return { error: data.message || "Token refresh failed" };
			} catch (error) {
				console.error("Token refresh error:", error);
				return { error: "Unexpected error during token refresh" };
			} finally {
				refreshPromise = null;
			}
		})();

		return refreshPromise;
	},
};
