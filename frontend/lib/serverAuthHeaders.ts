"use server";

import { cookies } from "next/headers";

/**
 * Get authenticated headers for server-side fetch calls.
 * Reads the accessToken cookie and sends it as a Bearer token.
 * 
 * NOTE: Content-Type is intentionally NOT set here — callers must set it
 * explicitly (e.g., "application/json" for JSON, or omit it for FormData so
 * the fetch API sets the correct multipart boundary automatically).
 */
export async function getAuthHeaders(
	additionalHeaders?: Record<string, string>,
): Promise<Record<string, string>> {
	const cookieStore = await cookies();
	const token = cookieStore.get("accessToken")?.value;

	if (!token) {
		throw new Error("No authentication token provided. Please log in.");
	}

	return {
		Authorization: `Bearer ${token}`,
		...additionalHeaders,
	};
}
