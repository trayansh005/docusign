// Utility functions for URL handling
export const ensureAbsoluteUrl = (url: string | undefined | null): string => {
	// Handle undefined/null URLs
	if (!url || typeof url !== "string") {
		console.warn("ensureAbsoluteUrl received invalid URL:", url);
		return "";
	}

	// If URL is already absolute (starts with http), return as is
	if (url.startsWith("http://") || url.startsWith("https://")) {
		return url;
	}

	// Add /api prefix if path starts with /uploads (to match server static route)
	let finalUrl = url;
	if (url.startsWith("/uploads")) {
		finalUrl = `/api${url}`;
	}

	// If URL is relative, prepend backend URL
	const backendUrl =
		process.env.NEXT_PUBLIC_API_URL?.replace("/api", "") || "http://localhost:5000";
	return `${backendUrl}${finalUrl}`;
};
