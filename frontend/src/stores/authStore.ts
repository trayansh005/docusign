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

interface AuthStore extends AuthState, AuthActions {}

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
					} else {
						get().clearAuth();
					}
				} catch (e) {
					console.error("Silent refresh failed:", e);
					get().clearAuth();
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
				const token = tokenUtils.getAccessToken();
				const user = tokenUtils.getStoredUser();

				if (token && user) {
					// Check if token is expired
					if (tokenUtils.isTokenExpired(token)) {
						const refreshToken = tokenUtils.getRefreshToken();
						if (refreshToken) {
							// Try to refresh the token
							const refreshResult = await tokenUtils.refreshAccessToken(refreshToken);
							if (refreshResult.accessToken && refreshResult.refreshToken) {
								tokenUtils.setTokens(refreshResult.accessToken, refreshResult.refreshToken);
								set({
									user: user as unknown as User,
									token: refreshResult.accessToken,
									isLoading: false,
									isAuthenticated: true,
								});
								scheduleSilentRefresh(refreshResult.accessToken);
								return;
							}
						}
						// Refresh failed, clear auth state
						get().clearAuth();
						return;
					}

					set({
						user: user as unknown as User,
						token,
						isLoading: false,
						isAuthenticated: true,
					});

					// Schedule refresh for current token
					scheduleSilentRefresh(token);
				} else {
					set({ isLoading: false });
				}
			} catch (error) {
				console.error("Error initializing auth:", error);
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

			const result = await authAPI.register(userData);

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
			try {
				await authAPI.logout();
			} catch (error) {
				console.error("Logout API error:", error);
				// Continue with local logout even if API call fails
			}

			get().clearAuth();
			clearRefreshTimer();

			// Redirect to login
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
