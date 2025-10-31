import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
	const pathname = request.nextUrl.pathname;
	const hasSessionId = request.cookies.has("sessionId");

	// Protected routes that require authentication
	const protectedPaths = ["/dashboard", "/fomiqsign", "/profile", "/settings", "/subscription"];
	const isProtected = protectedPaths.some((path) => pathname.startsWith(path));

	// Public routes that should redirect to dashboard if already logged in
	const authPaths = ["/login", "/register"];
	const isAuthPage = authPaths.includes(pathname);

	// For protected routes, check if user has session cookie
	if (isProtected) {
		if (!hasSessionId) {
			console.log(`[Middleware] No session cookie, redirecting ${pathname} to login`);
			const loginUrl = new URL("/login", request.url);
			loginUrl.searchParams.set("redirect", pathname);
			return NextResponse.redirect(loginUrl);
		}
		// Has session cookie, allow access
		return NextResponse.next();
	}

	// Redirect to dashboard if logged in user tries to access login/register
	if (isAuthPage && hasSessionId) {
		return NextResponse.redirect(new URL("/dashboard", request.url));
	}

	return NextResponse.next();
}

export const config = {
	matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
