/**
 * Auth client — talks directly to the backend JWT API.
 * Stores the access token in a JS-accessible cookie so it works
 * both locally and in production (no cross-origin cookie issues).
 */

export type AuthRole = "user" | "admin" | "superadmin";

export interface AuthUser {
	id: string;
	firstName: string;
	lastName: string;
	email: string;
	role: AuthRole;
	isAdmin: boolean;
	avatarUrl?: string;
	company?: string;
}

export interface AuthResult {
	success?: true;
	error?: string;
	user?: any;
}

const COOKIE_NAME = "accessToken";
const REFRESH_COOKIE = "refreshToken";
const ONE_DAY = 60 * 60 * 24;
const SEVEN_DAYS = ONE_DAY * 7;

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:5002/api").replace(/\/$/, "");

function setCookie(name: string, value: string, maxAge: number) {
  if (typeof document === "undefined") return;
	const secure = location.protocol === "https:" ? "; Secure" : "";
	document.cookie = `${name}=${value}; Path=/; Max-Age=${maxAge}; SameSite=Lax${secure}`;
}

function deleteCookie(name: string) {
  if (typeof document === "undefined") return;
  const secure = location.protocol === "https:" ? "; Secure" : "";
	document.cookie = `${name}=; Path=/; Max-Age=0; SameSite=Lax${secure}`;
}

export function getAccessToken(): string | null {
	if (typeof document === "undefined") return null;
	const match = document.cookie.match(new RegExp(`(?:^|; )${COOKIE_NAME}=([^;]*)`));
	return match ? decodeURIComponent(match[1]) : null;
}

export async function loginAction(email: string, password: string, rememberMe = false): Promise<AuthResult> {
	try {
		const res = await fetch(`${API_BASE_URL}/auth/login`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ email, password, rememberMe }),
		});

		const data = await res.json().catch(() => ({}));
		if (!res.ok) return { error: data?.message || "Invalid email or password." };

		// Store tokens in JS-accessible cookies (frontend-owned)
		if (data.data?.accessToken || data.token) {
      const token = data.data?.accessToken || data.token;
      setCookie(COOKIE_NAME, token, ONE_DAY);
    }
		if (data.data?.refreshToken || data.refreshToken) {
      const rfToken = data.data?.refreshToken || data.refreshToken;
      setCookie(REFRESH_COOKIE, rfToken, rememberMe ? SEVEN_DAYS * 4 : SEVEN_DAYS);
    }

		return { success: true, user: data.data?.user || data.user };
	} catch {
		return { error: "Unable to log in. Please try again." };
	}
}

export async function registerAction(payload: Record<string, any>): Promise<AuthResult> {
	try {
		const res = await fetch(`${API_BASE_URL}/auth/register`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(payload),
		});

		const data = await res.json().catch(() => ({}));
		if (!res.ok) return { error: data?.message || "Failed to register." };

		if (data.data?.accessToken || data.token) {
      const token = data.data?.accessToken || data.token;
      setCookie(COOKIE_NAME, token, ONE_DAY);
    }
		if (data.data?.refreshToken || data.refreshToken) {
      const rfToken = data.data?.refreshToken || data.refreshToken;
      setCookie(REFRESH_COOKIE, rfToken, SEVEN_DAYS);
    }

		return { success: true, user: data.data?.user || data.user };
	} catch (error) {
		return { error: "Unable to register. Please try again." };
	}
}

export async function logoutAction(): Promise<void> {
	try {
		const token = getAccessToken();
		await fetch(`${API_BASE_URL}/auth/logout`, {
			method: "POST",
			headers: token ? { Authorization: `Bearer ${token}` } : {},
		});
	} catch {
		// best-effort
	} finally {
		deleteCookie(COOKIE_NAME);
		deleteCookie(REFRESH_COOKIE);
    deleteCookie("sessionId"); // Clear legacy session cookie
	}
}
