import { create } from "zustand";
import { LoginCredentials, RegisterData, AuthResponse, User } from "@/types/auth";
import { tokenUtils } from "@/lib/tokenUtils";
import { authAPI } from "@/services/authAPI";

interface AuthState {
	user: User | null;
	token: string | null;
	isLoading: boolean;
	isAuthenticated: boolean;
}

interface AuthActions {
	// State setters
	setUser: (user: User | null) => void;
	setToken: (token: string | null) => void;
	setLoading: (isLoading: boolean) => void;
	setAuthenticated: (isAuthenticated: boolean) => void;

	// Auth operations
	login: (credentials: LoginCredentials) => Promise<AuthResponse>;
	register: (userData: RegisterData) => Promise<AuthResponse>;
	updateProfile: (profileData: Partial<User>) => Promise<AuthResponse>;
	changePassword: (passwordData: {
		currentPassword: string;
		newPassword: string;
	}) => Promise<AuthResponse>;
	logout: () => Promise<void>;
	clearAuth: () => void;
	initializeAuth: () => Promise<void>;
}

interface AuthStore extends AuthState, AuthActions { }

// Ref for managing refresh timer outside of store
let refreshTimerRef: NodeJS.Timeout | null = null;

const clearRefreshTimer = () => {
	if (refreshTimerRef) {
		clearTimeout(refreshTimerRef);
		refreshTimerRef = null;
	}
};

export const useAuthStore = create<AuthStore>((set, get) => {
	// Schedule silent token refresh
	const scheduleSilentRefresh = (accessToken: string) => {
		try {
			const payload = JSON.parse(atob(accessToken.split(".")[1]));
			const expMs = payload.exp * 1000;
			// refresh 60s before expiry; minimum 5s from now
			const delay = Math.max(expMs - Date.now() - 60_000, 5_000);
			clearRefreshTimer();
			refreshTimerRef = setTimeout(async () => {
				try {
					const rt = tokenUtils.getRefreshToken();
					if (!rt) {
						console.log("No refresh token available for silent refresh");
						get().clearAuth();
						return;
					}

					const refreshed = await tokenUtils.refreshAccessToken(rt);
					if (refreshed.accessToken && refreshed.refreshToken) {
						tokenUtils.setTokens(refreshed.accessToken, refreshed.refreshToken);
						set({
							token: refreshed.accessToken,
							isAuthenticated: true,
						});
						scheduleSilentRefresh(refreshed.accessToken);
						console.log("Silent refresh successful");
					} else {
						console.error("Silent refresh failed:", refreshed.error);
						get().clearAuth();
						// Only redirect if we're in a browser environment and not already on login page
						if (typeof window !== "undefined" && !window.location.pathname.includes("/login")) {
							window.location.href = "/login";
						}
					}
				} catch (e) {
					console.error("Silent refresh failed with exception:", e);
					get().clearAuth();
					// Only redirect if we're in a browser environment and not already on login page
					if (typeof window !== "undefined" && !window.location.pathname.includes("/login")) {
						window.location.href = "/login";
					}
				}
			}, delay);
		} catch {
			// If decode fails, don't schedule
		}
	};

	return {
		// Initial state
		user: null,
		token: null,
		isLoading: true,
		isAuthenticated: false,

		// State setters
		setUser: (user) => set({ user }),
		setToken: (token) => set({ token }),
		setLoading: (isLoading) => set({ isLoading }),
		setAuthenticated: (isAuthenticated) => set({ isAuthenticated }),

		// Initialize auth from storage on app load
		initializeAuth: async () => {
			try {
				console.log("🔄 Initializing auth...");
				let token = tokenUtils.getAccessToken();
				let storedUser = tokenUtils.getStoredUser();

				console.log("   Token from localStorage:", !!token);
				console.log("   Stored user:", !!storedUser);

				// If no token in localStorage, check cookies (fallback for cookie-only auth)
				if (!token && typeof document !== "undefined") {
					console.log("   Checking cookies...");
					console.log("   All cookies:", document.cookie);

					const cookieToken = document.cookie
						.split("; ")
						.find((row) => row.startsWith("accessToken="))
						?.split("=")[1];

					const cookieRefreshToken = document.cookie
						.split("; ")
						.find((row) => row.startsWith("refreshToken="))
						?.split("=")[1];

					if (cookieToken) {
						console.log("   ✅ Found token in cookies, syncing to localStorage");
						token = cookieToken;
						tokenUtils.setTokens(cookieToken, cookieRefreshToken);

						// Also need to get user data since we have a token but no stored user
						storedUser = null; // Force user fetch from backend
					} else {
						console.log("   ❌ No accessToken cookie found");
					}
				}

				// If we have a token (from localStorage or cookies) but no user, fetch user data
				// This handles the case where httpOnly cookies exist but localStorage was cleared
				if (token && !storedUser) {
					console.log("   Have token but no user, fetching user data from backend...");
					try {
						// Use profile endpoint which works with httpOnly cookies
						const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api"}/auth/profile`, {
							method: "GET",
							headers: {
								"Content-Type": "application/json",
								...(token && { Authorization: `Bearer ${token}` }),
							},
							credentials: "include", // Important for httpOnly cookies
						});

						if (response.ok) {
							const data = await response.json();
							if (data.success && data.data?.user) {
								console.log("   ✅ Got user from backend");
								tokenUtils.setStoredUser(data.data.user);
								storedUser = data.data.user;
							} else {
								console.log("   ❌ Invalid response from backend");
								token = null;
							}
						} else {
							console.log("   ❌ Failed to fetch user (status:", response.status, ")");
							token = null;
						}
					} catch (err) {
						console.error("   ❌ Error fetching user:", err);
						token = null;
					}
				}

				if (token && storedUser) {
					const isExpired = tokenUtils.isTokenExpired(token);
					console.log("   Token expired:", isExpired);

					// Check if token is expired
					if (isExpired) {
						const refreshToken = tokenUtils.getRefreshToken();
						if (refreshToken) {
							// Try to refresh the token
							const refreshResult = await tokenUtils.refreshAccessToken(refreshToken);
							if (refreshResult.accessToken && refreshResult.refreshToken) {
								tokenUtils.setTokens(refreshResult.accessToken, refreshResult.refreshToken);

								// Validate the refreshed token with backend
								const validation = await authAPI.validateToken();
								if (validation.success && validation.user) {
									tokenUtils.setStoredUser(validation.user);
									set({
										user: validation.user as User,
										token: refreshResult.accessToken,
										isLoading: false,
										isAuthenticated: true,
									});
									scheduleSilentRefresh(refreshResult.accessToken);
									return;
								}
							}
						}
						// Refresh failed, clear auth state
						get().clearAuth();
						return;
					}

					// Token is not expired, use stored user data
					const storedUser = tokenUtils.getStoredUser();
					if (storedUser) {
						console.log("   ✅ Setting authenticated state with stored user");
						// Use stored user data immediately
						set({
							user: storedUser as unknown as User,
							token,
							isLoading: false,
							isAuthenticated: true,
						});

						// Schedule refresh for current token
						scheduleSilentRefresh(token);

						// Optionally validate in background (don't block UI)
						authAPI.validateToken().then((validation) => {
							if (validation.success && validation.user) {
								// Update with fresh user data from backend
								tokenUtils.setStoredUser(validation.user);
								set({ user: validation.user as User });
							}
						}).catch((err) => {
							console.error("Background token validation failed:", err);
							// Don't clear auth on background validation failure
						});
					} else {
						// No stored user, try to validate with backend to get user data
						console.log("   No stored user, fetching from backend...");
						try {
							const validation = await authAPI.validateToken();
							if (validation.success && validation.user) {
								console.log("   ✅ Got user from backend, setting authenticated state");
								tokenUtils.setStoredUser(validation.user);
								set({
									user: validation.user as User,
									token,
									isLoading: false,
									isAuthenticated: true,
								});
								scheduleSilentRefresh(token);
							} else {
								console.log("   ❌ Backend validation failed");
								// Validation failed, clear auth
								get().clearAuth();
							}
						} catch (err) {
							console.error("   ❌ Token validation error:", err);
							get().clearAuth();
						}
					}
				} else {
					console.log("   ❌ No token or stored user, setting loading to false");
					set({ isLoading: false, isAuthenticated: false });
				}
			} catch (error) {
				console.error("❌ Error initializing auth:", error);
				get().clearAuth();
			}
		},

		// Login
		login: async (credentials: LoginCredentials): Promise<AuthResponse> => {
			set({ isLoading: true });

			const result = await authAPI.login(credentials);

			if (result.success && result.token && result.user) {
				tokenUtils.setTokens(result.token, result.refreshToken);
				tokenUtils.setStoredUser(result.user as unknown as Record<string, unknown>);

				set({
					user: result.user as User,
					token: result.token,
					isLoading: false,
					isAuthenticated: true,
				});

				scheduleSilentRefresh(result.token);
			} else {
				set({ isLoading: false });
			}

			return result;
		},

		// Register
		register: async (userData: RegisterData): Promise<AuthResponse> => {
			set({ isLoading: true });

			try {
				const result = await authAPI.register(userData);

				if (result.success) {
					// Check if registration includes auto-login (tokens provided)
					if (result.token && result.user) {
						tokenUtils.setTokens(result.token, result.refreshToken);
						tokenUtils.setStoredUser(result.user as unknown as Record<string, unknown>);
						set({
							user: result.user as User,
							token: result.token,
							isLoading: false,
							isAuthenticated: true,
						});
						scheduleSilentRefresh(result.token);
					} else {
						// Registration successful but no auto-login
						set({ isLoading: false });
					}
				} else {
					set({ isLoading: false });
				}

				return result;
			} catch (error) {
				console.error("Registration error in store:", error);
				set({ isLoading: false });
				return {
					success: false,
					message: "Registration failed. Please try again.",
				};
			}
		},

		// Update profile
		updateProfile: async (profileData: Partial<User>): Promise<AuthResponse> => {
			set({ isLoading: true });

			try {
				const result = await authAPI.updateProfile(profileData);

				if (result.success && result.user) {
					const updatedUser = result.user as User;
					tokenUtils.setStoredUser(updatedUser as unknown as Record<string, unknown>);

					set({
						user: updatedUser,
						isLoading: false,
					});
				} else {
					set({ isLoading: false });
				}

				return result;
			} catch (error) {
				console.error("Profile update error:", error);
				set({ isLoading: false });
				return {
					success: false,
					message: "Failed to update profile",
				};
			}
		},

		// Change password
		changePassword: async (passwordData: {
			currentPassword: string;
			newPassword: string;
		}): Promise<AuthResponse> => {
			set({ isLoading: true });

			try {
				const result = await authAPI.changePassword(passwordData);
				set({ isLoading: false });
				return result;
			} catch (error) {
				console.error("Password change error:", error);
				set({ isLoading: false });
				return {
					success: false,
					message: "Failed to change password",
				};
			}
		},

		// Logout
		logout: async (): Promise<void> => {
			const refreshToken = tokenUtils.getRefreshToken();

			// Always clear local state first to prevent any race conditions
			get().clearAuth();
			clearRefreshTimer();

			// Then attempt backend cleanup
			try {
				if (refreshToken) {
					await authAPI.logout();
				}
			} catch (error) {
				console.error("Logout API error:", error);
				// Backend cleanup failed, but local cleanup succeeded
				// This is acceptable as the user is still logged out locally
			}

			// Redirect after cleanup
			if (typeof window !== "undefined") {
				window.location.href = "/login";
			}
		},

		// Clear auth state
		clearAuth: () => {
			tokenUtils.clearTokens();
			clearRefreshTimer();
			set({
				user: null,
				token: null,
				isLoading: false,
				isAuthenticated: false,
			});
		},
	};
});

// Hook to initialize auth on app load
export const useInitializeAuth = () => {
	const initializeAuth = useAuthStore((state) => state.initializeAuth);

	return async () => {
		await initializeAuth();
	};
};
