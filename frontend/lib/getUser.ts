import { cookies } from "next/headers";
import { User } from "@/types/auth";

/**
 * Server-side helper — reads the accessToken cookie and fetches the current user.
 * Returns null if unauthenticated or on any error.
 */
export async function getUser(): Promise<User | null> {
	try {
		const cookieStore = await cookies();
		const accessToken = cookieStore.get("accessToken")?.value;
		if (!accessToken) return null;

		const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5002/api";
		const res = await fetch(`${apiUrl}/auth/profile`, {
			headers: { Cookie: `accessToken=${accessToken}` },
			cache: "no-store",
		});

		if (!res.ok) return null;

		const data = await res.json();
		return data?.data?.user ?? null;
	} catch {
		return null;
	}
}
