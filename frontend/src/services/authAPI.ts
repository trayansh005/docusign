import { LoginCredentials, RegisterData, AuthResponse } from "@/types/auth";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

export const authAPI = {
	async login(credentials: LoginCredentials): Promise<AuthResponse> {
		try {
			const response = await fetch(`${API_BASE_URL}/auth/login`, {
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

				return {
					success: true,
					message: data.message || "Login successful",
					token: data.data.token,
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
