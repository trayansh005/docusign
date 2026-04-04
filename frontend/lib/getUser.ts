import { cookies } from "next/headers";
import { User } from "@/types/auth";

/**
 * Server-side helper — reads the sessionId cookie and fetches the current user
 * from the backend. Returns null if unauthenticated or on any error.
 *
 * Use this in Server Components and layouts instead of the client auth store.
 */
export async function getUser(): Promise<User | null> {
	try {
		const cookieStore = await cookies();
		const sessionId = cookieStore.get("sessionId")?.value;
		if (!sessionId) return null;

		const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5002/api";
		const res = await fetch(`${apiUrl}/auth/profile`, {
			headers: { Cookie: `sessionId=${sessionId}` },
			// Don't cache — always get fresh auth state
			cache: "no-store",
		});

		if (!res.ok) return null;

		const data = await res.json();
		return data?.data?.user ?? null;
	} catch {
		return null;
	}
}
