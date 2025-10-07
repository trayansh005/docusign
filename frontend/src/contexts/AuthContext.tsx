"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useRouter } from "next/navigation";
import { LoginCredentials, RegisterData, AuthResponse, AuthState, User } from "@/types/auth";
import { tokenUtils } from "@/lib/tokenUtils";
import { authAPI } from "@/services/authAPI";

interface AuthContextType extends AuthState {
	login: (credentials: LoginCredentials) => Promise<AuthResponse>;
	register: (userData: RegisterData) => Promise<AuthResponse>;
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

	// Initialize auth state on mount
	useEffect(() => {
		const initializeAuth = async () => {
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
								setAuthState({
									user: user as unknown as User,
									token: refreshResult.accessToken,
									isLoading: false,
									isAuthenticated: true,
								});
								return;
							}
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
	}, []);

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
			tokenUtils.setTokens(result.token, ""); // Assuming no refresh token in result
			tokenUtils.setStoredUser(result.user as unknown as Record<string, unknown>);

			setAuthState({
				user: result.user as User,
				token: result.token,
				isLoading: false,
				isAuthenticated: true,
			});
		} else {
			setAuthState((prev) => ({ ...prev, isLoading: false }));
		}

		return result;
	};

	const register = async (userData: RegisterData): Promise<AuthResponse> => {
		setAuthState((prev) => ({ ...prev, isLoading: true }));

		const result = await authAPI.register(userData);

		setAuthState((prev) => ({ ...prev, isLoading: false }));

		return result;
	};

	const logout = async (): Promise<void> => {
		try {
			await authAPI.logout();
		} catch (error) {
			console.error("Logout API error:", error);
			// Continue with local logout even if API call fails
		}

		clearAuth();
		router.push("/login");
	};

	const contextValue: AuthContextType = {
		...authState,
		login,
		register,
		logout,
		clearAuth,
	};

	return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>;
};
