import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Next 16 uses the proxy convention (renamed from middleware)
export function proxy(request: NextRequest) {
	const pathname = request.nextUrl.pathname;
	const hasSessionId = request.cookies.has("sessionId");

	const protectedPaths = ["/dashboard", "/fomiqsign", "/profile", "/settings"];
	const isProtected = protectedPaths.some((path) => pathname.startsWith(path));

	const authPaths = ["/login", "/register"];
	const isAuthPage = authPaths.includes(pathname);

	if (isProtected) {
		if (!hasSessionId) {
			const loginUrl = new URL("/login", request.url);
			loginUrl.searchParams.set("redirect", pathname);
			return NextResponse.redirect(loginUrl);
		}
		return NextResponse.next();
	}

	if (isAuthPage && hasSessionId) {
		return NextResponse.redirect(new URL("/dashboard", request.url));
	}

	return NextResponse.next();
}

export const config = {
	matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
