import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

// Use server-side environment variable or fallback
const API_URL =
	process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

export async function POST(req: NextRequest) {
	try {
		const formData = await req.formData();
		const cookieStore = await cookies();
		const cookieHeader = cookieStore.toString();

		const res = await fetch(`${API_URL}/docusign/upload`, {
			method: "POST",
			headers: {
				// Let fetch set the proper multipart boundary
				...(cookieHeader ? { Cookie: cookieHeader } : {}),
			},
			body: formData,
			// Ensure we don't cache
			cache: "no-store",
		});

		const contentType = res.headers.get("content-type");
		const isJson = contentType?.includes("application/json");

		let data: string | Record<string, unknown>;
		try {
			data = isJson ? await res.json() : await res.text();
		} catch (parseErr) {
			console.error(
				`[Upload Route] Failed to parse response as ${isJson ? "JSON" : "text"}:`,
				parseErr
			);
			return NextResponse.json(
				{
					success: false,
					message: `Invalid response format from backend: ${
						isJson ? "JSON parse error" : "unexpected content"
					}`,
					contentType,
				},
				{ status: 502 }
			);
		}

		if (!res.ok) {
			const message =
				(isJson && typeof data === "object" ? data?.message : undefined) || `HTTP ${res.status}`;
			const code = isJson && typeof data === "object" ? data?.code : undefined;
			return NextResponse.json({ success: false, message, code }, { status: res.status });
		}

		// Ensure data is an object for JSON responses
		if (isJson && typeof data === "string") {
			try {
				data = JSON.parse(data);
			} catch (parseErr) {
				console.error("[Upload Route] Failed to parse string as JSON:", parseErr);
				return NextResponse.json(
					{ success: false, message: "Invalid JSON response from backend" },
					{ status: 502 }
				);
			}
		}

		// Pass through JSON success response
		return NextResponse.json(data);
	} catch (err) {
		console.error("/api/docusign/upload proxy error:", err);
		return NextResponse.json({ success: false, message: "Upload failed" }, { status: 500 });
	}
}
