import apiClient from "@/lib/apiClient";
import { LoginCredentials, RegisterData, AuthResponse, User } from "@/types/auth";

function clearBrowserCookie(name: string) {
	if (typeof document === "undefined") return;
	const secure = location.protocol === "https:" ? "; Secure" : "";
	const domain = window.location.hostname.includes("fomiqsign.com")
		? "; Domain=.fomiqsign.com"
		: "";
	document.cookie = `${name}=; Path=/; Max-Age=0; SameSite=Lax${secure}`;
	if (domain) {
		document.cookie = `${name}=; Path=/; Max-Age=0; SameSite=Lax${secure}${domain}`;
	}
}

export const authAPI = {
	async logout(): Promise<void> {
		try {
			await apiClient.post("/auth/logout", {});
		} catch (error) {
			console.error("Logout API error:", error);
		} finally {
			// Clear frontend-owned cookies as a safety measure
			clearBrowserCookie("accessToken");
			clearBrowserCookie("refreshToken");
			clearBrowserCookie("sessionId");
		}
	},

	async login(credentials: LoginCredentials): Promise<AuthResponse> {
		try {
			const data = await apiClient.post<{
				success: boolean;
				message?: string;
				data?: { user: User };
			}>("/auth/login", credentials);
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
				return {
					success: true,
					message: data.message || "Registration successful",
					user: data.data.user,
				};
			}
			if (data.errors && Array.isArray(data.errors)) {
				return { success: false, message: data.errors.map((e) => e.message).join(", ") };
			}
			return { success: false, message: data.message || "Registration failed" };
		} catch (error) {
			console.error("Registration error:", error);
			return { success: false, message: "Network error. Please try again." };
		}
	},

	async getProfile(): Promise<{ success: boolean; user?: User }> {
		try {
			const data = await apiClient.get<{ success: boolean; data?: { user: User } }>(
				"/auth/profile",
			);
			if (data.success && data.data?.user) {
				return { success: true, user: data.data.user };
			}
			return { success: false };
		} catch (error: unknown) {
			if (
				error &&
				typeof error === "object" &&
				"status" in error &&
				(error as { status: number }).status === 401
			) {
				return { success: false };
			}
			console.error("Get profile error:", error);
			return { success: false };
		}
	},

	async updateProfile(profileData: Partial<User>): Promise<AuthResponse> {
		try {
			const data = await apiClient.put<{
				success: boolean;
				message?: string;
				data?: { user: User };
			}>("/auth/profile", profileData);
			if (data.success && data.data?.user) {
				return {
					success: true,
					message: data.message || "Profile updated successfully",
					user: data.data.user,
				};
			}
			return { success: false, message: data.message || "Failed to update profile" };
		} catch (error) {
			if (
				error &&
				typeof error === "object" &&
				"status" in error &&
				(error as { status: number }).status === 401
			) {
				throw error;
			}
			console.error("Profile update error:", error);
			return { success: false, message: "Network error. Please try again." };
		}
	},

	async changePassword(passwordData: {
		currentPassword: string;
		newPassword: string;
	}): Promise<AuthResponse> {
		try {
			const data = await apiClient.put<{ success: boolean; message?: string }>(
				"/auth/change-password",
				passwordData,
			);
			if (data.success) {
				return { success: true, message: data.message || "Password changed successfully" };
			}
			return { success: false, message: data.message || "Failed to change password" };
		} catch (error) {
			if (
				error &&
				typeof error === "object" &&
				"status" in error &&
				(error as { status: number }).status === 401
			) {
				throw error;
			}
			console.error("Password change error:", error);
			return { success: false, message: "Network error. Please try again." };
		}
	},

	async logoutAll(): Promise<{ success: boolean; message?: string }> {
		try {
			const data = await apiClient.post<{ success: boolean; message?: string }>("/auth/logout-all");
			return { success: data.success, message: data.message };
		} catch (error) {
			console.error("Logout all error:", error);
			return { success: false, message: "Network error. Please try again." };
		}
	},
};
