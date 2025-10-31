import { create } from "zustand";
import { LoginCredentials, RegisterData, AuthResponse, User } from "@/types/auth";
import { authAPI } from "@/services/authAPI";

interface AuthState {
	user: User | null;
	isLoading: boolean;
	isInitialized: boolean;
}

interface AuthActions {
	setUser: (user: User | null) => void;
	clearUser: () => void;
	initialize: () => Promise<void>;
	login: (credentials: LoginCredentials) => Promise<AuthResponse>;
	register: (userData: RegisterData) => Promise<AuthResponse>;
	updateProfile: (profileData: Partial<User>) => Promise<AuthResponse>;
	changePassword: (passwordData: {
		currentPassword: string;
		newPassword: string;
	}) => Promise<AuthResponse>;
	logout: () => Promise<void>;
}

interface AuthStore extends AuthState, AuthActions { }

export const useAuthStore = create<AuthStore>((set, get) => {
	return {
		// Initial state
		user: null,
		isLoading: false,
		isInitialized: false,

		// State setters
		setUser: (user) => set({ user }),

		// Clear user state
		clearUser: () => {
			set({
				user: null,
			});
		},

		// Initialize auth from session cookie on app load
		initialize: async () => {
			set({ isLoading: true });

			try {
				const result = await authAPI.getProfile();

				if (result.success && result.user) {
					set({
						user: result.user,
						isLoading: false,
						isInitialized: true,
					});
				} else {
					set({
						user: null,
						isLoading: false,
						isInitialized: true,
					});
				}
			} catch (error) {
				// Network error or 401 - clear user state
				set({
					user: null,
					isLoading: false,
					isInitialized: true,
				});
			}
		},

		// Login
		login: async (credentials: LoginCredentials): Promise<AuthResponse> => {
			set({ isLoading: true });

			const result = await authAPI.login(credentials);

			if (result.success && result.user) {
				set({
					user: result.user,
					isLoading: false,
				});
			} else {
				set({ isLoading: false });
			}

			return result;
		},

		// Register
		register: async (userData: RegisterData): Promise<AuthResponse> => {
			set({ isLoading: true });

			const result = await authAPI.register(userData);

			if (result.success && result.user) {
				set({
					user: result.user,
					isLoading: false,
				});
			} else {
				set({ isLoading: false });
			}

			return result;
		},

		// Update profile
		updateProfile: async (profileData: Partial<User>): Promise<AuthResponse> => {
			set({ isLoading: true });

			const result = await authAPI.updateProfile(profileData);

			if (result.success && result.user) {
				set({
					user: result.user,
					isLoading: false,
				});
			} else {
				set({ isLoading: false });
			}

			return result;
		},

		// Change password
		changePassword: async (passwordData: {
			currentPassword: string;
			newPassword: string;
		}): Promise<AuthResponse> => {
			set({ isLoading: true });
			const result = await authAPI.changePassword(passwordData);
			set({ isLoading: false });
			return result;
		},

		// Logout
		logout: async (): Promise<void> => {
			get().clearUser();

			try {
				await authAPI.logout();
			} catch (error) {
				console.error("Logout API error:", error);
			}

			if (typeof window !== "undefined") {
				window.location.href = "/login";
			}
		},
	};
});
