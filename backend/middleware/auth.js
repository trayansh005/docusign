import jwt from "jsonwebtoken";
import User from "../models/User.js";

// Authentication middleware
export const authenticateToken = async (req, res, next) => {
	try {
		const authHeader = req.headers.authorization;
		// Support Bearer token in Authorization header or httpOnly cookie named accessToken
		let token = authHeader && authHeader.split(" ")[1]; // Bearer TOKEN
		if (!token && req.cookies && req.cookies.accessToken) {
			token = req.cookies.accessToken;
		}

		if (!token) {
			return res.status(401).json({
				success: false,
				message: "Access token required",
			});
		}

		const decoded = jwt.verify(token, process.env.JWT_SECRET);
		const user = await User.findById(decoded.id).select("-password");

		if (!user) {
			return res.status(401).json({
				success: false,
				message: "Invalid token - user not found",
			});
		}

		req.user = user;
		next();
	} catch (error) {
		if (error.name === "JsonWebTokenError") {
			return res.status(401).json({
				success: false,
				message: "Invalid token",
			});
		}
		if (error.name === "TokenExpiredError") {
			return res.status(401).json({
				success: false,
				message: "Token expired",
			});
		}

		return res.status(500).json({
			success: false,
			message: "Authentication error",
		});
	}
};

// Optional authentication middleware
export const optionalAuth = async (req, res, next) => {
	try {
		const authHeader = req.headers.authorization;
		let token = authHeader && authHeader.split(" ")[1];
		if (!token && req.cookies && req.cookies.accessToken) {
			token = req.cookies.accessToken;
		}

		if (token) {
			const decoded = jwt.verify(token, process.env.JWT_SECRET);
			const user = await User.findById(decoded.id).select("-password");
			req.user = user;
		}

		next();
	} catch (error) {
		// Continue without authentication for optional auth
		next();
	}
};

// Legacy middleware for backward compatibility
export const authenticate = authenticateToken;
