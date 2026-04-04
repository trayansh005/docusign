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
	role: 'user' | 'admin';
	lastLogin?: string;
	emailVerified: boolean;
	isActive: boolean;
	createdAt: string;
	updatedAt: string;
}

export interface AuthResponse {
	success: boolean;
	message: string;
	user?: User;
}

export interface Session {
	id: string;
	deviceInfo: {
		deviceName: string;
		userAgent: string;
		ip: string;
	};
	createdAt: string;
	lastActivity: string;
	expiresAt: string;
	isCurrentSession: boolean;
}

export interface AuthState {
	user: User | null;
	isLoading: boolean;
	isInitialized: boolean;
}
