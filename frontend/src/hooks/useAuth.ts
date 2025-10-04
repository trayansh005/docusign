"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { LoginCredentials, RegisterData, AuthResponse, AuthState, User } from "@/types/auth";
import { tokenUtils } from "@/lib/tokenUtils";


const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5000/api/auth";

export const useAuth = () => {
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

	const login = async (credentials: LoginCredentials): Promise<AuthResponse> => {
		setAuthState((prev) => ({ ...prev, isLoading: true }));

		try {
			const response = await fetch(`${API_BASE_URL}/login`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify(credentials),
			});

			const data = await response.json();

			if (response.ok && data.success && data.data?.token) {
				const user = data.data.user || {
					id: data.data.userId || "1",
					firstName: data.data.firstName || "User",
					lastName: data.data.lastName || "",
					email: credentials.email,
					createdAt: new Date().toISOString(),
					updatedAt: new Date().toISOString(),
				};

				// Store tokens using tokenUtils (includes localStorage and cookies)
				tokenUtils.setTokens(data.data.token, data.data.refreshToken);
				tokenUtils.setStoredUser(user);

				setAuthState({
					user: user as User,
					token: data.data.token,
					isLoading: false,
					isAuthenticated: true,
				});

				return {
					success: true,
					message: data.message || "Login successful",
					token: data.data.token,
					user,
				};
			} else {
				setAuthState((prev) => ({ ...prev, isLoading: false }));
				return {
					success: false,
					message: data.message || "Login failed",
				};
			}
		} catch (error) {
			console.error("Login error:", error);
			setAuthState((prev) => ({ ...prev, isLoading: false }));
			return {
				success: false,
				message: "Network error. Please try again.",
			};
		}
	};

	const register = async (userData: RegisterData): Promise<AuthResponse> => {
		setAuthState((prev) => ({ ...prev, isLoading: true }));

		try {
			const response = await fetch(`${API_BASE_URL}/register`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					firstName: userData.firstName,
					lastName: userData.lastName,
					email: userData.email,
					password: userData.password,
					phoneNumber: userData.phoneNumber,
					company: userData.company,
				}),
			});

			const data = await response.json();

			setAuthState((prev) => ({ ...prev, isLoading: false }));

			if (response.ok) {
				return {
					success: true,
					message: data.message || "Registration successful",
				};
			} else {
				console.error("Registration failed:", data);

				// Handle validation errors specifically
				if (data.errors && Array.isArray(data.errors)) {
					const errorMessages = data.errors
						.map((error: { message: string }) => error.message)
						.join(", ");
					return {
						success: false,
						message: `Validation failed: ${errorMessages}`,
					};
				}

				return {
					success: false,
					message: data.message || "Registration failed",
				};
			}
		} catch (error) {
			console.error("Registration error:", error);
			setAuthState((prev) => ({ ...prev, isLoading: false }));
			return {
				success: false,
				message: "Network error. Please try again.",
			};
		}
	};

	const logout = async () => {
		try {
			// Call backend logout endpoint to clear server-side refresh tokens
			await fetch(`${API_BASE_URL}/logout`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${authState.token}`,
				},
				credentials: "include", // Include cookies
			});
		} catch (error) {
			console.error("Logout error:", error);
		} finally {
			// Clear client-side state regardless of server response
			tokenUtils.clearTokens();
			setAuthState({
				user: null,
				token: null,
				isLoading: false,
				isAuthenticated: false,
			});
			router.push("/login");
		}
	};

	const clearAuth = () => {
		tokenUtils.clearTokens();
		setAuthState({
			user: null,
			token: null,
			isLoading: false,
			isAuthenticated: false,
		});
	};

	return {
		...authState,
		login,
		register,
		logout,
		clearAuth,
	};
};
