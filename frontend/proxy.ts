import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(request: NextRequest) {
	const pathname = request.nextUrl.pathname;
	// JWT auth — check for accessToken cookie (set by backend on login)
	const hasToken = request.cookies.has("accessToken");

	const protectedPaths = ["/dashboard", "/fomiqsign", "/profile", "/settings", "/subscription"];
	const isProtected = protectedPaths.some((path) => pathname.startsWith(path));

	const authPaths = ["/login", "/register"];
	const isAuthPage = authPaths.includes(pathname);

	if (isProtected && !hasToken) {
		const loginUrl = new URL("/login", request.url);
		loginUrl.searchParams.set("redirect", pathname);
		return NextResponse.redirect(loginUrl);
	}

	if (isAuthPage && hasToken) {
		return NextResponse.redirect(new URL("/dashboard", request.url));
	}

	return NextResponse.next();
}

export const config = {
	matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
