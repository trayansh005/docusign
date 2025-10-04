import rateLimit from "express-rate-limit";

// Rate limiting middleware
export const createRateLimit = (options = {}) => {
	return rateLimit({
		windowMs: options.windowMs || 15 * 60 * 1000, // 15 minutes
		max: options.max || 100, // limit each IP to 100 requests per windowMs
		message: {
			success: false,
			message: "Too many requests from this IP, please try again later.",
		},
		standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
		legacyHeaders: false, // Disable the `X-RateLimit-*` headers
		...options,
	});
};

// Strict rate limiting for auth endpoints
export const authRateLimit = createRateLimit({
	windowMs: 15 * 60 * 1000, // 15 minutes
	max: 5, // limit each IP to 5 requests per windowMs for auth endpoints
	message: {
		success: false,
		message: "Too many authentication attempts, please try again in 15 minutes.",
	},
});

// API rate limiting
export const apiRateLimit = createRateLimit({
	windowMs: 15 * 60 * 1000, // 15 minutes
	max: 100, // limit each IP to 100 requests per windowMs
});

// Request sanitization
export const sanitizeInput = (req, res, next) => {
	// Remove any potential XSS attempts
	const sanitize = (obj) => {
		if (typeof obj === "string") {
			return obj.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");
		}
		if (typeof obj === "object" && obj !== null) {
			for (const key in obj) {
				if (obj.hasOwnProperty(key)) {
					obj[key] = sanitize(obj[key]);
				}
			}
		}
		return obj;
	};

	req.body = sanitize(req.body);
	req.query = sanitize(req.query);
	req.params = sanitize(req.params);

	next();
};
