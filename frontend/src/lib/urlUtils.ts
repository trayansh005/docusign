// Utility functions for URL handling
export const ensureAbsoluteUrl = (url: string): string => {
	// If URL is already absolute (starts with http), return as is
	if (url.startsWith("http://") || url.startsWith("https://")) {
		return url;
	}

	// If URL is relative, prepend backend URL
	const backendUrl =
		process.env.NEXT_PUBLIC_API_URL?.replace("/api", "") || "http://localhost:5000";
	return `${backendUrl}${url}`;
};
