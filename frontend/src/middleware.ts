import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
	const pathname = request.nextUrl.pathname;
	const token = request.cookies.get("accessToken")?.value;
	const refresh = request.cookies.get("refreshToken")?.value;

	console.log("🔥 MIDDLEWARE EXECUTING:", pathname);
	console.log("   Token present:", !!token);

	// Protected routes
	const protectedPaths = ["/dashboard", "/fomiqsign", "/profile"];
	const isProtected = protectedPaths.some((path) => pathname.startsWith(path));

	console.log("   Is protected route:", isProtected);

	// Redirect to login if accessing protected route without tokens
	// Allow access when refreshToken exists; client can refresh on first render
	if (isProtected && !token && !refresh) {
		console.log("   ❌ REDIRECTING to /login (no token)");
		return NextResponse.redirect(new URL("/login", request.url));
	}

	// Redirect to dashboard if logged in user tries to access login/register
	if (token && (pathname === "/login" || pathname === "/register")) {
		console.log("   ↩️  REDIRECTING to /dashboard (already logged in)");
		return NextResponse.redirect(new URL("/dashboard", request.url));
	}

	console.log("   ✅ ALLOWING access");
	return NextResponse.next();
}

export const config = {
	matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
