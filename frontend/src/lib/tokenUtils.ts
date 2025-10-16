// Token management utilities
export const TOKEN_STORAGE_KEY = "accessToken";
export const REFRESH_TOKEN_STORAGE_KEY = "refreshToken";
export const USER_STORAGE_KEY = "user";

export const tokenUtils = {
	// Get token from localStorage
	getAccessToken: (): string | null => {
		if (typeof window === "undefined") return null;
		return localStorage.getItem(TOKEN_STORAGE_KEY);
	},

	// Get refresh token from localStorage
	getRefreshToken: (): string | null => {
		if (typeof window === "undefined") return null;
		return localStorage.getItem(REFRESH_TOKEN_STORAGE_KEY);
	},

	// Set tokens in localStorage and cookies
	setTokens: (accessToken: string, refreshToken?: string): void => {
		if (typeof window === "undefined") return;

		// Store in localStorage for client-side use
		localStorage.setItem(TOKEN_STORAGE_KEY, accessToken);
		if (refreshToken) {
			localStorage.setItem(REFRESH_TOKEN_STORAGE_KEY, refreshToken);
		}

		// Also set non-httpOnly cookies for Next middleware checks (backend also sets httpOnly cookies)
		document.cookie = `${TOKEN_STORAGE_KEY}=${accessToken}; path=/; max-age=${
			15 * 60
		}; SameSite=lax`;
		if (refreshToken) {
			document.cookie = `${REFRESH_TOKEN_STORAGE_KEY}=${refreshToken}; path=/; max-age=${
				7 * 24 * 60 * 60
			}; SameSite=lax`;
		}
	},

	// Remove tokens from localStorage and cookies
	clearTokens: (): void => {
		if (typeof window === "undefined") return;

		// Clear localStorage
		localStorage.removeItem(TOKEN_STORAGE_KEY);
		localStorage.removeItem(REFRESH_TOKEN_STORAGE_KEY);
		localStorage.removeItem(USER_STORAGE_KEY);

		// Clear cookies
		document.cookie = `${TOKEN_STORAGE_KEY}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
		document.cookie = `${REFRESH_TOKEN_STORAGE_KEY}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
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

	// Refresh token API call
	refreshAccessToken: async (
		refreshToken: string
	): Promise<{ accessToken?: string; refreshToken?: string; error?: string }> => {
		try {
			const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";
			// Backend exposes refresh under /api/auth/refresh-token
			const response = await fetch(`${apiBase}/auth/refresh-token`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ refreshToken }),
				credentials: "include", // Important for cookies
			});

			const data = await response.json();

			if (response.ok && data.success) {
				return {
					accessToken: data.data.accessToken,
					refreshToken: data.data.refreshToken,
				};
			} else {
				return { error: data.message || "Token refresh failed" };
			}
		} catch (error) {
			console.error("Token refresh error:", error);
			return { error: "Network error during token refresh" };
		}
	},
};
