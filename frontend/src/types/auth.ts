export interface LoginCredentials {
	email: string;
	password: string;
	userType?: "admin" | "user";
}

export interface RegisterData {
	firstName: string;
	lastName: string;
	email: string;
	password: string;
	phoneNumber?: string;
	company?: string;
}

export interface User {
	id: string;
	firstName: string;
	lastName: string;
	email: string;
	phoneNumber?: string;
	company?: string;
	createdAt: string;
	updatedAt: string;
}

export interface AuthResponse {
	success: boolean;
	message: string;
	token?: string;
	user?: User;
}

export interface AuthState {
	user: User | null;
	token: string | null;
	isLoading: boolean;
	isAuthenticated: boolean;
}
