import axios from "axios";

class IPLocationService {
	// Extract IP address from request headers
	extractIPAddress(req) {
		const forwarded = req.headers["x-forwarded-for"];
		const realIP = req.headers["x-real-ip"];
		const clientIP = req.headers["x-client-ip"];
		const cfConnectingIP = req.headers["cf-connecting-ip"];

		// Priority: CF-Connecting-IP > X-Forwarded-For > X-Real-IP > X-Client-IP > req.connection.remoteAddress
		const ip =
			cfConnectingIP ||
			forwarded ||
			realIP ||
			clientIP ||
			req.connection?.remoteAddress ||
			req.socket?.remoteAddress;

		// Handle comma-separated values (X-Forwarded-For can have multiple IPs)
		if (ip && typeof ip === "string") {
			return ip.split(",")[0].trim();
		}

		return ip || "unknown";
	}

	// Get location data from IP address
	async getLocationFromIP(ip) {
		try {
			// Skip lookup for localhost/private IPs
			if (
				!ip ||
				ip === "unknown" ||
				ip === "::1" ||
				ip.startsWith("127.") ||
				ip.startsWith("192.168.") ||
				ip.startsWith("10.") ||
				ip.startsWith("172.")
			) {
				return {
					country: "Local",
					city: "Development",
					regionName: "Local Network",
					ip: ip || "unknown",
				};
			}

			// Use ip-api.com for free IP geolocation
			const response = await axios.get(
				`http://ip-api.com/json/${ip}?fields=status,country,city,regionName,query`,
				{
					timeout: 5000, // 5 second timeout
				}
			);

			if (response.data && response.data.status === "success") {
				return {
					country: response.data.country || "Unknown",
					city: response.data.city || "Unknown",
					regionName: response.data.regionName || "Unknown",
					ip: response.data.query || ip,
				};
			}

			// Fallback for failed lookups
			return {
				country: "Unknown",
				city: "Unknown",
				regionName: "Unknown",
				ip: ip,
			};
		} catch (error) {
			console.error("IP location lookup failed:", error.message);
			return {
				country: "Unknown",
				city: "Unknown",
				regionName: "Unknown",
				ip: ip,
			};
		}
	}

	// Get location statistics for a template (placeholder for future analytics)
	async getLocationStatistics(templateId) {
		// This would aggregate location data from audit trails
		// For now, return basic structure
		return {
			totalSignings: 0,
			uniqueLocations: 0,
			topCountries: [],
			recentActivity: [],
		};
	}
}

export default new IPLocationService();
