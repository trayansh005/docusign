import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Helper function to check if token is expired
function isTokenExpired(token: string): boolean {
	try {
		const payload = JSON.parse(atob(token.split(".")[1]));
		const exp = payload.exp * 1000; // Convert to milliseconds
		return Date.now() >= exp;
	} catch {
		return true;
	}
}

export function middleware(request: NextRequest) {
	const pathname = request.nextUrl.pathname;
	const token = request.cookies.get("accessToken")?.value;
	const refresh = request.cookies.get("refreshToken")?.value;

	console.log("🔥 MIDDLEWARE EXECUTING:", pathname);
	console.log("   Token present:", !!token);
	console.log("   Refresh token present:", !!refresh);

	// Protected routes
	const protectedPaths = ["/dashboard", "/fomiqsign", "/profile", "/settings", "/subscription"];
	const isProtected = protectedPaths.some((path) => pathname.startsWith(path));

	console.log("   Is protected route:", isProtected);

	// For protected routes, check authentication
	if (isProtected) {
		// If we have a valid access token, allow access
		if (token && !isTokenExpired(token)) {
			console.log("   ✅ ALLOWING access (valid token)");
			return NextResponse.next();
		}

		// If access token is expired or missing, check if we have a refresh token
		if (refresh && !isTokenExpired(refresh)) {
			console.log("   ⏳ ALLOWING access (will refresh on client)");
			// Allow access - client will handle token refresh
			return NextResponse.next();
		}

		// No valid tokens, redirect to login
		console.log("   ❌ REDIRECTING to /login (no valid tokens)");
		return NextResponse.redirect(new URL("/login", request.url));
	}

	// Redirect to dashboard if logged in user tries to access login/register
	if ((pathname === "/login" || pathname === "/register")) {
		// Check if user has valid tokens
		if (token && !isTokenExpired(token)) {
			console.log("   ↩️  REDIRECTING to /dashboard (already logged in)");
			return NextResponse.redirect(new URL("/dashboard", request.url));
		}

		// If only refresh token exists, let them access login/register
		// They might need to re-authenticate
	}

	console.log("   ✅ ALLOWING access");
	return NextResponse.next();
}

export const config = {
	matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
