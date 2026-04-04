import apiClient from "@/lib/apiClient";
import { LoginCredentials, RegisterData, AuthResponse, User, Session } from "@/types/auth";

export const authAPI = {
	async login(credentials: LoginCredentials): Promise<AuthResponse> {
		try {
			const data = await apiClient.post<{ success: boolean; message?: string; data?: { user: User } }>(
				"/auth/login",
				credentials
			);
			if (data.success && data.data?.user) {
				return { success: true, message: data.message || "Login successful", user: data.data.user };
			}
			return { success: false, message: data.message || "Login failed" };
		} catch (error) {
			console.error("Login error:", error);
			return { success: false, message: "Network error. Please try again." };
		}
	},

	async register(userData: RegisterData): Promise<AuthResponse> {
		try {
			const data = await apiClient.post<{
				success: boolean;
				message?: string;
				data?: { user: User };
				errors?: { message: string }[];
			}>("/auth/register", userData);

			if (data.success && data.data?.user) {
				return { success: true, message: data.message || "Registration successful", user: data.data.user };
			}
			if (data.errors && Array.isArray(data.errors)) {
				const errorMessages = data.errors.map((e) => e.message).join(", ");
				return { success: false, message: `Validation failed: ${errorMessages}` };
			}
			return { success: false, message: data.message || "Registration failed" };
		} catch (error) {
			console.error("Registration error:", error);
			return { success: false, message: "Network error. Please try again." };
		}
	},

	async getProfile(): Promise<{ success: boolean; user?: User }> {
		try {
			const data = await apiClient.get<{ success: boolean; data?: { user: User } }>("/auth/profile");
			if (data.success && data.data?.user) {
				return { success: true, user: data.data.user };
			}
			return { success: false };
		} catch (error: unknown) {
			// 401 means unauthenticated — not an unexpected error
			if (error && typeof error === "object" && "status" in error && (error as { status: number }).status === 401) {
				return { success: false };
			}
			console.error("Get profile error:", error);
			return { success: false };
		}
	},

	async updateProfile(profileData: Partial<User>): Promise<AuthResponse> {
		try {
			const data = await apiClient.put<{ success: boolean; message?: string; data?: { user: User } }>(
				"/auth/profile",
				profileData
			);
			if (data.success && data.data?.user) {
				return { success: true, message: data.message || "Profile updated successfully", user: data.data.user };
			}
			return { success: false, message: data.message || "Failed to update profile" };
		} catch (error) {
			if (error && typeof error === "object" && "status" in error && (error as { status: number }).status === 401) {
				throw error;
			}
			console.error("Profile update error:", error);
			return { success: false, message: "Network error. Please try again." };
		}
	},

	async changePassword(passwordData: { currentPassword: string; newPassword: string }): Promise<AuthResponse> {
		try {
			const data = await apiClient.put<{ success: boolean; message?: string }>("/auth/change-password", passwordData);
			if (data.success) {
				return { success: true, message: data.message || "Password changed successfully" };
			}
			return { success: false, message: data.message || "Failed to change password" };
		} catch (error) {
			if (error && typeof error === "object" && "status" in error && (error as { status: number }).status === 401) {
				throw error;
			}
			console.error("Password change error:", error);
			return { success: false, message: "Network error. Please try again." };
		}
	},

	async logout(): Promise<void> {
		try {
			await apiClient.post("/auth/logout", {});
		} catch (error) {
			console.error("Logout API error:", error);
		}
	},

	async getSessions(): Promise<{ success: boolean; sessions?: Session[] }> {
		try {
			const data = await apiClient.get<{ success: boolean; data?: { sessions: Session[] } }>("/auth/sessions");
			if (data.success && data.data?.sessions) {
				return { success: true, sessions: data.data.sessions };
			}
			return { success: false };
		} catch (error) {
			if (error && typeof error === "object" && "status" in error && (error as { status: number }).status === 401) {
				throw error;
			}
			console.error("Get sessions error:", error);
			return { success: false };
		}
	},

	async deleteSession(sessionId: string): Promise<{ success: boolean; message?: string }> {
		try {
			const data = await apiClient.delete<{ success: boolean; message?: string }>(`/auth/sessions/${sessionId}`);
			return { success: data.success, message: data.message };
		} catch (error) {
			if (error && typeof error === "object" && "status" in error && (error as { status: number }).status === 401) {
				throw error;
			}
			console.error("Delete session error:", error);
			return { success: false, message: "Network error. Please try again." };
		}
	},

	async logoutAll(): Promise<{ success: boolean; message?: string }> {
		try {
			const data = await apiClient.post<{ success: boolean; message?: string }>("/auth/logout-all");
			return { success: data.success, message: data.message };
		} catch (error) {
			if (error && typeof error === "object" && "status" in error && (error as { status: number }).status === 401) {
				throw error;
			}
			console.error("Logout all error:", error);
			return { success: false, message: "Network error. Please try again." };
		}
	},
};
