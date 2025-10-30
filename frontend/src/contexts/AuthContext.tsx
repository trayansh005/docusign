"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useRouter } from "next/navigation";
import { LoginCredentials, RegisterData, AuthResponse, AuthState, User } from "@/types/auth";
import { tokenUtils } from "@/lib/tokenUtils";
import { authAPI } from "@/services/authAPI";
import { useRef, useCallback } from "react";

interface AuthContextType extends AuthState {
	login: (credentials: LoginCredentials) => Promise<AuthResponse>;
	register: (userData: RegisterData) => Promise<AuthResponse>;
	updateProfile: (profileData: Partial<User>) => Promise<AuthResponse>;
	changePassword: (passwordData: {
		currentPassword: string;
		newPassword: string;
	}) => Promise<AuthResponse>;
	logout: () => Promise<void>;
	clearAuth: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
	const context = useContext(AuthContext);
	if (context === undefined) {
		throw new Error("useAuth must be used within an AuthProvider");
	}
	return context;
};

interface AuthProviderProps {
	children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
	const [authState, setAuthState] = useState<AuthState>({
		user: null,
		token: null,
		isLoading: true,
		isAuthenticated: false,
	});

	const router = useRouter();
	const refreshTimerRef = useRef<NodeJS.Timeout | null>(null);

	const clearRefreshTimer = useCallback(() => {
		if (refreshTimerRef.current) {
			clearTimeout(refreshTimerRef.current);
			refreshTimerRef.current = null;
		}
	}, []);

	const scheduleSilentRefresh = useCallback(
		(accessToken: string) => {
			try {
				const payload = JSON.parse(atob(accessToken.split(".")[1]));
				const expMs = payload.exp * 1000;
				// refresh 60s before expiry; minimum 5s from now
				const delay = Math.max(expMs - Date.now() - 60_000, 5_000);
				clearRefreshTimer();
				refreshTimerRef.current = setTimeout(async () => {
					try {
						// Use cookie-based refresh
						const refreshed = await tokenUtils.refreshAccessToken();
						if (refreshed.accessToken) {
							tokenUtils.setTokens(refreshed.accessToken);
							setAuthState((prev) => ({
								...prev,
								token: refreshed.accessToken!,
								isAuthenticated: true,
							}));
							scheduleSilentRefresh(refreshed.accessToken);
						} else {
							clearAuth();
						}
					} catch (e) {
						console.error("Silent refresh failed:", e);
						clearAuth();
					}
				}, delay);
			} catch {
				// If decode fails, don't schedule
			}
		},
		[clearRefreshTimer]
	);

	// Initialize auth state on mount
	useEffect(() => {
		const initializeAuth = async () => {
			try {
				const token = tokenUtils.getAccessToken();
				const user = tokenUtils.getStoredUser();

				if (token && user) {
					// Check if token is expired
					if (tokenUtils.isTokenExpired(token)) {
						// Try cookie-based refresh
						const refreshResult = await tokenUtils.refreshAccessToken();
						if (refreshResult.accessToken) {
							tokenUtils.setTokens(refreshResult.accessToken);
							setAuthState({
								user: user as unknown as User,
								token: refreshResult.accessToken,
								isLoading: false,
								isAuthenticated: true,
							});
							return;
						}
						// Refresh failed, clear auth state
						clearAuth();
						return;
					}

					setAuthState({
						user: user as unknown as User,
						token,
						isLoading: false,
						isAuthenticated: true,
					});

					// schedule refresh for current token
					if (token) scheduleSilentRefresh(token);
				} else {
					setAuthState((prev) => ({
						...prev,
						isLoading: false,
					}));
				}
			} catch (error) {
				console.error("Error initializing auth:", error);
				clearAuth();
			}
		};

		initializeAuth();
		return () => clearRefreshTimer();
	}, [clearRefreshTimer, scheduleSilentRefresh]);

	const clearAuth = () => {
		tokenUtils.clearTokens();
		setAuthState({
			user: null,
			token: null,
			isLoading: false,
			isAuthenticated: false,
		});
	};

	const login = async (credentials: LoginCredentials): Promise<AuthResponse> => {
		setAuthState((prev) => ({ ...prev, isLoading: true }));

		const result = await authAPI.login(credentials);

		if (result.success && result.token && result.user) {
			// Persist access token; refresh token is stored as httpOnly cookie by backend
			tokenUtils.setTokens(result.token);
			tokenUtils.setStoredUser(result.user as unknown as Record<string, unknown>);

			setAuthState({
				user: result.user as User,
				token: result.token,
				isLoading: false,
				isAuthenticated: true,
			});

			// schedule refresh
			scheduleSilentRefresh(result.token);
		} else {
			setAuthState((prev) => ({ ...prev, isLoading: false }));
		}

		return result;
	};

	const register = async (userData: RegisterData): Promise<AuthResponse> => {
		setAuthState((prev) => ({ ...prev, isLoading: true }));

		const result = await authAPI.register(userData);

		if (result.success && result.token && result.user) {
			// Auto-login after registration when backend provides tokens
			tokenUtils.setTokens(result.token);
			tokenUtils.setStoredUser(result.user as unknown as Record<string, unknown>);
			setAuthState({
				user: result.user as User,
				token: result.token,
				isLoading: false,
				isAuthenticated: true,
			});
			// schedule refresh
			scheduleSilentRefresh(result.token);
		} else {
			setAuthState((prev) => ({ ...prev, isLoading: false }));
		}

		return result;
	};

	const updateProfile = async (profileData: Partial<User>): Promise<AuthResponse> => {
		setAuthState((prev) => ({ ...prev, isLoading: true }));

		try {
			const result = await authAPI.updateProfile(profileData);

			if (result.success && result.user) {
				const updatedUser = result.user as User;
				tokenUtils.setStoredUser(updatedUser as unknown as Record<string, unknown>);

				setAuthState((prev) => ({
					...prev,
					user: updatedUser,
					isLoading: false,
				}));
			} else {
				setAuthState((prev) => ({ ...prev, isLoading: false }));
			}

			return result;
		} catch (error) {
			console.error("Profile update error:", error);
			setAuthState((prev) => ({ ...prev, isLoading: false }));
			return {
				success: false,
				message: "Failed to update profile",
			};
		}
	};

	const changePassword = async (passwordData: {
		currentPassword: string;
		newPassword: string;
	}): Promise<AuthResponse> => {
		setAuthState((prev) => ({ ...prev, isLoading: true }));

		try {
			const result = await authAPI.changePassword(passwordData);
			setAuthState((prev) => ({ ...prev, isLoading: false }));
			return result;
		} catch (error) {
			console.error("Password change error:", error);
			setAuthState((prev) => ({ ...prev, isLoading: false }));
			return {
				success: false,
				message: "Failed to change password",
			};
		}
	};

	const logout = async (): Promise<void> => {
		try {
			await authAPI.logout();
		} catch (error) {
			console.error("Logout API error:", error);
			// Continue with local logout even if API call fails
		}

		clearAuth();
		clearRefreshTimer();
		router.push("/login");
	};

	const contextValue: AuthContextType = {
		...authState,
		login,
		register,
		updateProfile,
		changePassword,
		logout,
		clearAuth,
	};

	return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>;
};
