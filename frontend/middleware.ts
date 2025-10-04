import { type JWTPayload, jwtVerify } from "jose";
import { type NextRequest, NextResponse } from "next/server";

// Configuration constants
const CONFIG = {
	// Authentication paths
	PATHS: {
		LOGIN: "/login",
		REGISTER: "/register",
		DASHBOARD: "/home",
		HOME: "/",
		DOCUSIGN: "/fomiqsign",
	},
	// Protected routes that require authentication
	PROTECTED_ROUTES: ["/home", "/subscription", "/fomiqsign", "/profile"],
	// Public routes that don't require authentication
	PUBLIC_ROUTES: ["/", "/login", "/register"],
	// Token configuration
	TOKEN: {
		ACCESS_MAX_AGE: 15 * 60, // 15 minutes
		REFRESH_MAX_AGE: 7 * 24 * 60 * 60, // 7 days
	},
} as const;

interface UserPayload extends JWTPayload {
	id: string;
	firstName: string;
	lastName: string;
	email: string;
	userType: string;
}

// JWT verification utility
async function verifyJWT(token: string): Promise<UserPayload | null> {
	const secret = process.env.JWT_SECRET || process.env.NEXT_PUBLIC_JWT_SECRET;
	if (!secret) {
		console.error("JWT_SECRET environment variable is not set.");
		return null;
	}

	try {
		const secretKey = new TextEncoder().encode(secret);
		const { payload } = await jwtVerify<UserPayload>(token, secretKey);

		if (payload.id && payload.email) {
			return payload;
		}
		console.error("JWT payload structure is invalid:", payload);
		return null;
	} catch (error) {
		if (process.env.NODE_ENV === "development") {
			console.error("JWT verification failed:", error instanceof Error ? error.message : error);
		}
		return null;
	}
}

// Token refresh utility
class TokenManager {
	static async tryRefreshToken(request: NextRequest): Promise<{
		accessToken: string | null;
		refreshToken: string | null;
		response?: NextResponse;
	}> {
		const refreshToken = request.cookies.get("refreshToken")?.value;
		if (!refreshToken) {
			return { accessToken: null, refreshToken: null };
		}

		try {
			const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5000/api/auth";
			const response = await fetch(`${apiUrl}/refresh-token`, {
				method: "POST",
				headers: {
					Cookie: `refreshToken=${refreshToken}`,
					"Content-Type": "application/json",
				},
				credentials: "include",
			});

			if (response.ok) {
				return this.parseTokenResponse(response);
			} else if (process.env.NODE_ENV === "development") {
				console.log("Token refresh failed:", response.status, response.statusText);
			}
		} catch (error) {
			console.error("Middleware token refresh failed:", error);
		}

		return { accessToken: null, refreshToken: null };
	}

	private static parseTokenResponse(response: Response): {
		accessToken: string | null;
		refreshToken: string | null;
		response?: NextResponse;
	} {
		const setCookieHeaders = response.headers.get("set-cookie");
		if (!setCookieHeaders) {
			return { accessToken: null, refreshToken: null };
		}

		const accessTokenMatch = setCookieHeaders.match(/accessToken=([^;]+)/);
		const refreshTokenMatch = setCookieHeaders.match(/refreshToken=([^;]+)/);

		const newAccessToken = accessTokenMatch?.[1] || null;
		const newRefreshToken = refreshTokenMatch?.[1] || null;

		if (newAccessToken) {
			return {
				accessToken: newAccessToken,
				refreshToken: newRefreshToken,
				response: this.createResponseWithTokens(newAccessToken, newRefreshToken),
			};
		}

		return { accessToken: null, refreshToken: null };
	}

	private static createResponseWithTokens(
		accessToken: string,
		refreshToken: string | null
	): NextResponse {
		const nextResponse = NextResponse.next();
		const isProduction = process.env.NODE_ENV === "production";

		// Set access token
		nextResponse.cookies.set("accessToken", accessToken, {
			httpOnly: true,
			secure: isProduction,
			sameSite: isProduction ? "strict" : "lax",
			maxAge: CONFIG.TOKEN.ACCESS_MAX_AGE,
			path: "/",
		});

		// Set refresh token if rotated
		if (refreshToken) {
			nextResponse.cookies.set("refreshToken", refreshToken, {
				httpOnly: true,
				secure: isProduction,
				sameSite: isProduction ? "strict" : "lax",
				maxAge: CONFIG.TOKEN.REFRESH_MAX_AGE,
				path: "/",
			});
		}

		return nextResponse;
	}
}

// Path matching utilities
class PathMatcher {
	static isProtectedRoute(pathname: string): boolean {
		return CONFIG.PROTECTED_ROUTES.some(
			(route) => pathname === route || pathname.startsWith(`${route}/`)
		);
	}

	static isPublicRoute(pathname: string): boolean {
		return CONFIG.PUBLIC_ROUTES.some(
			(route) => pathname === route || pathname.startsWith(`${route}/`)
		);
	}

	static isLoginPage(pathname: string): boolean {
		return pathname === CONFIG.PATHS.LOGIN || pathname === CONFIG.PATHS.REGISTER;
	}

	static getLoginRedirectUrl(request: NextRequest): URL {
		return new URL(CONFIG.PATHS.LOGIN, request.url);
	}

	static getDashboardUrl(request: NextRequest): URL {
		return new URL(CONFIG.PATHS.DASHBOARD, request.url);
	}
}

// Main middleware logic
class MiddlewareHandler {
	static async handleTokenRefresh(
		request: NextRequest,
		token?: string
	): Promise<{
		token?: string;
		refreshResponse?: NextResponse;
	}> {
		if (!token) {
			const refreshResult = await TokenManager.tryRefreshToken(request);
			if (refreshResult.accessToken) {
				return {
					token: refreshResult.accessToken,
					refreshResponse: refreshResult.response,
				};
			}
			return {};
		}

		// Verify existing token
		const user = await verifyJWT(token);
		if (!user) {
			const refreshResult = await TokenManager.tryRefreshToken(request);
			if (refreshResult.accessToken) {
				return {
					token: refreshResult.accessToken,
					refreshResponse: refreshResult.response,
				};
			}
			return {};
		}

		return { token };
	}

	static async handleProtectedRoute(
		pathname: string,
		token: string | undefined,
		request: NextRequest
	): Promise<NextResponse | null> {
		if (!PathMatcher.isProtectedRoute(pathname)) {
			return null; // Not a protected route, continue
		}

		if (!token) {
			if (process.env.NODE_ENV === "development") {
				console.log(`[Middleware] No token for protected path: ${pathname}`);
			}
			return NextResponse.redirect(PathMatcher.getLoginRedirectUrl(request));
		}

		// Verify token for protected routes
		const user = await verifyJWT(token);
		if (!user) {
			if (process.env.NODE_ENV === "development") {
				console.log(`[Middleware] Invalid token for path: ${pathname}`);
			}
			return NextResponse.redirect(PathMatcher.getLoginRedirectUrl(request));
		}

		return null; // User is authenticated, continue
	}

	static async handleLoginRedirect(
		pathname: string,
		token: string | undefined,
		request: NextRequest
	): Promise<NextResponse | null> {
		if (!PathMatcher.isLoginPage(pathname) || !token) {
			return null;
		}

		const user = await verifyJWT(token);
		if (!user) {
			return null; // Invalid token, let them access login page
		}

		// Redirect authenticated users away from login pages
		if (process.env.NODE_ENV === "development") {
			console.log(`[Middleware] Authenticated user accessing login page, redirecting to dashboard`);
		}

		return NextResponse.redirect(PathMatcher.getDashboardUrl(request));
	}

	static async handleRootRedirect(
		pathname: string,
		token: string | undefined,
		request: NextRequest
	): Promise<NextResponse | null> {
		if (pathname !== "/" || !token) {
			return null;
		}

		const user = await verifyJWT(token);
		if (user) {
			// Redirect authenticated users from root to dashboard
			return NextResponse.redirect(PathMatcher.getDashboardUrl(request));
		}

		return null;
	}
}

export async function middleware(request: NextRequest) {
	const { pathname } = request.nextUrl;

	// Skip middleware for API routes and static files
	if (
		pathname.startsWith("/api/") ||
		pathname.startsWith("/_next/") ||
		pathname.startsWith("/static/") ||
		pathname.includes(".") // Files with extensions
	) {
		return NextResponse.next();
	}

	const token = request.cookies.get("accessToken")?.value;

	// For debugging - log token status
	if (process.env.NODE_ENV === "development") {
		console.log(`[Middleware] Path: ${pathname}, Token: ${token ? "present" : "missing"}`);
	}

	// Handle root page redirect for authenticated users
	const rootRedirect = await MiddlewareHandler.handleRootRedirect(pathname, token, request);
	if (rootRedirect) return rootRedirect;

	// Handle login page redirects for authenticated users
	const loginRedirect = await MiddlewareHandler.handleLoginRedirect(pathname, token, request);
	if (loginRedirect) return loginRedirect;

	// Handle protected route access
	const protectedRouteResponse = await MiddlewareHandler.handleProtectedRoute(
		pathname,
		token,
		request
	);
	if (protectedRouteResponse) return protectedRouteResponse;

	// Continue normally
	return NextResponse.next();
}

export const config = {
	matcher: [
		/*
		 * Match all request paths except for the ones starting with:
		 * - api (API routes)
		 * - _next/static (static files)
		 * - _next/image (image optimization files)
		 * - favicon.ico (favicon file)
		 */
		"/((?!api|_next/static|_next/image|favicon.ico).*)",
	],
};
