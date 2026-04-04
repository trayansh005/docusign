import { LoginCredentials, RegisterData, AuthResponse, User, Session } from "@/types/auth";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

export const authAPI = {
	async login(credentials: LoginCredentials): Promise<AuthResponse> {
		try {
			const response = await fetch(`${API_BASE_URL}/auth/login`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				credentials: "include",
				body: JSON.stringify(credentials),
			});

			const data = await response.json();

			if (response.ok && data.success) {
				return {
					success: true,
					message: data.message || "Login successful",
					user: data.data.user,
				};
			} else {
				return {
					success: false,
					message: data.message || "Login failed",
				};
			}
		} catch (error) {
			console.error("Login error:", error);
			return {
				success: false,
				message: "Network error. Please try again.",
			};
		}
	},

	async register(userData: RegisterData): Promise<AuthResponse> {
		try {
			const response = await fetch(`${API_BASE_URL}/auth/register`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				credentials: "include",
				body: JSON.stringify(userData),
			});

			const data = await response.json();

			if (response.ok && data.success) {
				return {
					success: true,
					message: data.message || "Registration successful",
					user: data.data.user,
				};
			} else {
				// Handle validation errors
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
			return {
				success: false,
				message: "Network error. Please try again.",
			};
		}
	},

	async updateProfile(profileData: Partial<User>): Promise<AuthResponse> {
		try {
			const response = await fetch(`${API_BASE_URL}/auth/profile`, {
				method: "PUT",
				headers: {
					"Content-Type": "application/json",
				},
				credentials: "include",
				body: JSON.stringify(profileData),
			});

			// Handle 401 Unauthorized
			if (response.status === 401) {
				const error = new Error("Unauthorized") as Error & { status: number };
				error.status = 401;
				throw error;
			}

			const data = await response.json();

			if (response.ok && data.success) {
				return {
					success: true,
					message: data.message || "Profile updated successfully",
					user: data.data?.user,
				};
			} else {
				return {
					success: false,
					message: data.message || "Failed to update profile",
				};
			}
		} catch (error) {
			// Re-throw 401 errors for auth error handler
			if (error && typeof error === "object" && "status" in error && error.status === 401) {
				throw error;
			}
			console.error("Profile update error:", error);
			return {
				success: false,
				message: "Network error. Please try again.",
			};
		}
	},

	async changePassword(passwordData: {
		currentPassword: string;
		newPassword: string;
	}): Promise<AuthResponse> {
		try {
			const response = await fetch(`${API_BASE_URL}/auth/change-password`, {
				method: "PUT",
				headers: {
					"Content-Type": "application/json",
				},
				credentials: "include",
				body: JSON.stringify(passwordData),
			});

			// Handle 401 Unauthorized
			if (response.status === 401) {
				const error = new Error("Unauthorized") as Error & { status: number };
				error.status = 401;
				throw error;
			}

			const data = await response.json();

			if (response.ok && data.success) {
				return {
					success: true,
					message: data.message || "Password changed successfully",
				};
			} else {
				return {
					success: false,
					message: data.message || "Failed to change password",
				};
			}
		} catch (error) {
			// Re-throw 401 errors for auth error handler
			if (error && typeof error === "object" && "status" in error && error.status === 401) {
				throw error;
			}
			console.error("Password change error:", error);
			return {
				success: false,
				message: "Network error. Please try again.",
			};
		}
	},

	async getProfile(): Promise<{ success: boolean; user?: User }> {
		try {
			const response = await fetch(`${API_BASE_URL}/auth/profile`, {
				method: "GET",
				headers: {
					"Content-Type": "application/json",
				},
				credentials: "include",
			});

			// Handle 401 Unauthorized - session expired
			if (response.status === 401) {
				return { success: false };
			}

			const data = await response.json();

			if (response.ok && data.success) {
				return {
					success: true,
					user: data.data.user,
				};
			} else {
				return { success: false };
			}
		} catch (error) {
			console.error("Get profile error:", error);
			return { success: false };
		}
	},

	async logout(): Promise<void> {
		try {
			await fetch(`${API_BASE_URL}/auth/logout`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				credentials: "include",
			});
		} catch (error) {
			console.error("Logout API error:", error);
		}
	},

	async getSessions(): Promise<{ success: boolean; sessions?: Session[] }> {
		try {
			const response = await fetch(`${API_BASE_URL}/auth/sessions`, {
				method: "GET",
				headers: {
					"Content-Type": "application/json",
				},
				credentials: "include",
			});

			// Handle 401 Unauthorized
			if (response.status === 401) {
				const error = new Error("Unauthorized") as Error & { status: number };
				error.status = 401;
				throw error;
			}

			const data = await response.json();

			if (response.ok && data.success) {
				return {
					success: true,
					sessions: data.data.sessions,
				};
			} else {
				return { success: false };
			}
		} catch (error) {
			// Re-throw 401 errors for auth error handler
			if (error && typeof error === "object" && "status" in error && error.status === 401) {
				throw error;
			}
			console.error("Get sessions error:", error);
			return { success: false };
		}
	},

	async deleteSession(sessionId: string): Promise<{ success: boolean; message?: string }> {
		try {
			const response = await fetch(`${API_BASE_URL}/auth/sessions/${sessionId}`, {
				method: "DELETE",
				headers: {
					"Content-Type": "application/json",
				},
				credentials: "include",
			});

			// Handle 401 Unauthorized
			if (response.status === 401) {
				const error = new Error("Unauthorized") as Error & { status: number };
				error.status = 401;
				throw error;
			}

			const data = await response.json();

			if (response.ok && data.success) {
				return {
					success: true,
					message: data.message || "Session deleted successfully",
				};
			} else {
				return {
					success: false,
					message: data.message || "Failed to delete session",
				};
			}
		} catch (error) {
			// Re-throw 401 errors for auth error handler
			if (error && typeof error === "object" && "status" in error && error.status === 401) {
				throw error;
			}
			console.error("Delete session error:", error);
			return {
				success: false,
				message: "Network error. Please try again.",
			};
		}
	},

	async logoutAll(): Promise<{ success: boolean; message?: string }> {
		try {
			const response = await fetch(`${API_BASE_URL}/auth/logout-all`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				credentials: "include",
			});

			// Handle 401 Unauthorized
			if (response.status === 401) {
				const error = new Error("Unauthorized") as Error & { status: number };
				error.status = 401;
				throw error;
			}

			const data = await response.json();

			if (response.ok && data.success) {
				return {
					success: true,
					message: data.message || "Logged out from all devices successfully",
				};
			} else {
				return {
					success: false,
					message: data.message || "Failed to logout from all devices",
				};
			}
		} catch (error) {
			// Re-throw 401 errors for auth error handler
			if (error && typeof error === "object" && "status" in error && error.status === 401) {
				throw error;
			}
			console.error("Logout all error:", error);
			return {
				success: false,
				message: "Network error. Please try again.",
			};
		}
	},
};
