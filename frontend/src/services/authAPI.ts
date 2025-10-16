import { LoginCredentials, RegisterData, AuthResponse, User } from "@/types/auth";
import { tokenUtils } from "@/lib/tokenUtils";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

export const authAPI = {
	async login(credentials: LoginCredentials): Promise<AuthResponse> {
		try {
			const response = await fetch(`${API_BASE_URL}/auth/login`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				// Ensure backend can set httpOnly cookies (accessToken, refreshToken)
				credentials: "include",
				body: JSON.stringify(credentials),
			});

			const data = await response.json();

			// Access token may be returned as data.accessToken or legacy data.token
			const accessToken: string | undefined = data?.data?.accessToken || data?.data?.token;
			const refreshToken: string | undefined = data?.data?.refreshToken;

			if (response.ok && data.success && accessToken) {
				const user = data.data.user || {
					id: data.data.userId || "1",
					firstName: data.data.firstName || "User",
					lastName: data.data.lastName || "",
					email: credentials.email,
					createdAt: new Date().toISOString(),
					updatedAt: new Date().toISOString(),
				};

				return {
					success: true,
					message: data.message || "Login successful",
					token: accessToken,
					refreshToken,
					user,
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
			return {
				success: false,
				message: "Network error. Please try again.",
			};
		}
	},

	async updateProfile(profileData: Partial<User>): Promise<AuthResponse> {
		try {
			const token = tokenUtils.getAccessToken();
			if (!token) {
				return {
					success: false,
					message: "No authentication token found",
				};
			}

			const response = await fetch(`${API_BASE_URL}/auth/profile`, {
				method: "PUT",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${token}`,
				},
				// Include cookies so backend can also authenticate via httpOnly cookies if present
				credentials: "include",
				body: JSON.stringify(profileData),
			});

			const data = await response.json();

			if (response.ok && data.success) {
				return {
					success: true,
					message: data.message || "Profile updated successfully",
					user: data.data?.user || data.user,
				};
			} else {
				return {
					success: false,
					message: data.message || "Failed to update profile",
				};
			}
		} catch (error) {
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
			const token = tokenUtils.getAccessToken();
			if (!token) {
				return {
					success: false,
					message: "No authentication token found",
				};
			}

			const response = await fetch(`${API_BASE_URL}/auth/change-password`, {
				method: "PUT",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${token}`,
				},
				credentials: "include",
				body: JSON.stringify(passwordData),
			});

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
			console.error("Password change error:", error);
			return {
				success: false,
				message: "Network error. Please try again.",
			};
		}
	},

	async logout(): Promise<void> {
		try {
			// Call backend logout endpoint
			await fetch(`${API_BASE_URL}/auth/logout`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				credentials: "include",
			});
		} catch (error) {
			console.error("Logout API error:", error);
			// Continue even if API call fails
		}
	},
};
