import crypto from "crypto";
import User from "../models/User.js";
import Session from "../models/Session.js";
import { parseDeviceName } from "../utils/deviceParser.js";
import { customValidations } from "../middlewares/validation.js";

// Cookie configuration (env-overridable for cross-site deployments)
// If your frontend and backend are on different domains, set:
// COOKIE_SAMESITE=none and COOKIE_SECURE=true (requires HTTPS)
const cookieConfig = {
	httpOnly: true,
	secure:
		process.env.COOKIE_SECURE !== undefined
			? String(process.env.COOKIE_SECURE).toLowerCase() === "true"
			: process.env.NODE_ENV === "production",
	sameSite:
		process.env.COOKIE_SAMESITE !== undefined
			? process.env.COOKIE_SAMESITE
			: process.env.NODE_ENV === "production"
				? "strict"
				: "lax",
	...(process.env.COOKIE_DOMAIN ? { domain: process.env.COOKIE_DOMAIN } : {}),
	path: "/",
};

// Register controller
export const register = async (req, res) => {
	try {
		const { firstName, lastName, email, password, phoneNumber, company } = req.body;

		// Validate required fields
		if (!firstName || !lastName || !email || !password) {
			return res.status(400).json({
				success: false,
				message: "Missing required fields",
				errors: {
					firstName: !firstName ? "First name is required" : null,
					lastName: !lastName ? "Last name is required" : null,
					email: !email ? "Email is required" : null,
					password: !password ? "Password is required" : null,
				},
			});
		}

		// Validate email format
		if (!customValidations.isValidEmail(email)) {
			return res.status(400).json({
				success: false,
				message: "Invalid email format",
			});
		}

		// Validate password strength
		if (!customValidations.isStrongPassword(password)) {
			return res.status(400).json({
				success: false,
				message:
					"Password must be at least 8 characters long and contain uppercase, lowercase, and numeric characters",
			});
		}

		// Check if user already exists
		const existingUser = await User.findOne({ email: email.toLowerCase() });
		if (existingUser) {
			return res.status(409).json({
				success: false,
				message: "User with this email already exists",
			});
		}

		// Create new user
		const userData = {
			firstName: firstName.trim(),
			lastName: lastName.trim(),
			email: email.toLowerCase().trim(),
			password,
			phoneNumber: phoneNumber?.trim(),
			company: company?.trim(),
		};

		const user = new User(userData);
		await user.save();

		// Auto-login after registration with session-based authentication
		// Generate UUID for sessionId
		const sessionId = crypto.randomUUID();

		// Parse device info from request headers
		const userAgent = req.headers["user-agent"] || "Unknown";
		const ip = req.ip || req.connection.remoteAddress || "Unknown";
		const deviceName = parseDeviceName(userAgent);

		// Create Session document in database
		const session = new Session({
			sessionId,
			userId: user._id,
			deviceInfo: {
				userAgent,
				ip,
				deviceName,
			},
			expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
		});

		await session.save();

		// Update last login
		user.lastLogin = new Date();
		await user.save();

		// Set httpOnly cookie with sessionId
		res.cookie("sessionId", sessionId, {
			...cookieConfig,
			maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
		});

		// Remove password from response
		const userResponse = user.toObject();
		delete userResponse.password;

		res.status(201).json({
			success: true,
			message: "User registered and logged in successfully",
			data: {
				user: userResponse,
			},
		});
	} catch (error) {
		console.error("Registration error:", error);

		if (error.code === 11000) {
			return res.status(409).json({
				success: false,
				message: "User with this email already exists",
			});
		}

		res.status(500).json({
			success: false,
			message: "Registration failed. Please try again.",
			...(process.env.NODE_ENV === "development" && { error: error.message }),
		});
	}
};

// Login controller with session-based authentication
export const login = async (req, res) => {
	try {
		const { email, password } = req.body;

		// Validate required fields
		if (!email || !password) {
			return res.status(400).json({
				success: false,
				message: "Email and password are required",
			});
		}

		// Find user by email
		const user = await User.findOne({ email: email.toLowerCase() });
		if (!user) {
			return res.status(401).json({
				success: false,
				message: "Invalid credentials",
			});
		}

		// Verify password
		const isPasswordValid = await user.comparePassword(password);
		if (!isPasswordValid) {
			return res.status(401).json({
				success: false,
				message: "Invalid credentials",
			});
		}

		// Generate UUID for sessionId
		const sessionId = crypto.randomUUID();

		// Parse device info from request headers
		const userAgent = req.headers["user-agent"] || "Unknown";
		const ip = req.ip || req.connection.remoteAddress || "Unknown";
		const deviceName = parseDeviceName(userAgent);

		// Create Session document in database
		const session = new Session({
			sessionId,
			userId: user._id,
			deviceInfo: {
				userAgent,
				ip,
				deviceName,
			},
			expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
		});

		await session.save();

		// Update last login
		user.lastLogin = new Date();
		await user.save();

		// Set httpOnly cookie with sessionId
		res.cookie("sessionId", sessionId, {
			...cookieConfig,
			maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
		});

		// Prepare user response
		const userResponse = user.toObject();
		delete userResponse.password;

		res.status(200).json({
			success: true,
			message: "Login successful",
			data: {
				user: userResponse,
			},
		});
	} catch (error) {
		console.error("Login error:", error);
		res.status(500).json({
			success: false,
			message: "Login failed. Please try again.",
			...(process.env.NODE_ENV === "development" && { error: error.message }),
		});
	}
};

// Get user profile
export const getProfile = async (req, res) => {
	try {
		const user = req.user;

		const userResponse = user.toObject();
		delete userResponse.password;

		res.status(200).json({
			success: true,
			data: {
				user: userResponse,
			},
		});
	} catch (error) {
		console.error("Get profile error:", error);
		res.status(500).json({
			success: false,
			message: "Failed to fetch profile",
			...(process.env.NODE_ENV === "development" && { error: error.message }),
		});
	}
};

// Update user profile
export const updateProfile = async (req, res) => {
	try {
		const { firstName, lastName, phoneNumber, company } = req.body;
		const userId = req.user._id;

		const updateData = {};
		if (firstName) updateData.firstName = firstName.trim();
		if (lastName) updateData.lastName = lastName.trim();
		if (phoneNumber) updateData.phoneNumber = phoneNumber.trim();
		if (company) updateData.company = company.trim();

		const user = await User.findByIdAndUpdate(
			userId,
			{ $set: updateData },
			{ new: true, runValidators: true }
		).select("-password");

		if (!user) {
			return res.status(404).json({
				success: false,
				message: "User not found",
			});
		}

		res.status(200).json({
			success: true,
			message: "Profile updated successfully",
			data: {
				user,
			},
		});
	} catch (error) {
		console.error("Update profile error:", error);
		res.status(500).json({
			success: false,
			message: "Failed to update profile",
			...(process.env.NODE_ENV === "development" && { error: error.message }),
		});
	}
};

// Change password
export const changePassword = async (req, res) => {
	try {
		const { currentPassword, newPassword } = req.body;
		const userId = req.user._id;

		if (!currentPassword || !newPassword) {
			return res.status(400).json({
				success: false,
				message: "Current password and new password are required",
			});
		}

		if (!customValidations.isStrongPassword(newPassword)) {
			return res.status(400).json({
				success: false,
				message:
					"New password must be at least 8 characters long and contain uppercase, lowercase, and numeric characters",
			});
		}

		const user = await User.findById(userId);
		if (!user) {
			return res.status(404).json({
				success: false,
				message: "User not found",
			});
		}

		const isCurrentPasswordValid = await user.comparePassword(currentPassword);
		if (!isCurrentPasswordValid) {
			return res.status(401).json({
				success: false,
				message: "Current password is incorrect",
			});
		}

		user.password = newPassword;
		await user.save();

		res.status(200).json({
			success: true,
			message: "Password changed successfully",
		});
	} catch (error) {
		console.error("Change password error:", error);
		res.status(500).json({
			success: false,
			message: "Failed to change password",
			...(process.env.NODE_ENV === "development" && { error: error.message }),
		});
	}
};



// Logout controller
export const logout = async (req, res) => {
	try {
		// Extract sessionId from cookie
		const sessionId = req.cookies?.sessionId;

		if (sessionId) {
			// Find and delete session from database
			await Session.findOneAndDelete({ sessionId });
		}

		// Clear sessionId cookie by setting maxAge to 0
		res.cookie("sessionId", "", {
			...cookieConfig,
			maxAge: 0,
		});

		res.status(200).json({
			success: true,
			message: "Logged out successfully",
		});
	} catch (error) {
		console.error("Logout error:", error);
		res.status(500).json({
			success: false,
			message: "Logout failed",
		});
	}
};

// Get active sessions controller
export const getSessions = async (req, res) => {
	try {
		const userId = req.user._id;
		const currentSessionId = req.cookies?.sessionId;

		// Query all active sessions for authenticated user
		const sessions = await Session.find({
			userId,
			isActive: true,
		})
			.sort({ lastActivity: -1 }) // Order by lastActivity descending
			.lean();

		// Transform sessions to client-safe format
		const sessionList = sessions.map((session) => ({
			id: session._id.toString(),
			deviceInfo: {
				deviceName: session.deviceInfo.deviceName,
				userAgent: session.deviceInfo.userAgent,
				ip: session.deviceInfo.ip,
			},
			createdAt: session.createdAt,
			lastActivity: session.lastActivity,
			expiresAt: session.expiresAt,
			isCurrentSession: session.sessionId === currentSessionId, // Mark current session
		}));

		res.status(200).json({
			success: true,
			data: {
				sessions: sessionList,
			},
		});
	} catch (error) {
		console.error("Get sessions error:", error);
		res.status(500).json({
			success: false,
			message: "Failed to fetch sessions",
			...(process.env.NODE_ENV === "development" && { error: error.message }),
		});
	}
};

// Delete specific session controller
export const deleteSession = async (req, res) => {
	try {
		const userId = req.user._id;
		const sessionIdToDelete = req.params.sessionId;

		if (!sessionIdToDelete) {
			return res.status(400).json({
				success: false,
				message: "Session ID is required",
			});
		}

		// Find the session by _id (MongoDB ObjectId)
		const session = await Session.findById(sessionIdToDelete);

		if (!session) {
			return res.status(404).json({
				success: false,
				message: "Session not found",
			});
		}

		// Verify session belongs to authenticated user
		if (session.userId.toString() !== userId.toString()) {
			return res.status(403).json({
				success: false,
				message: "Cannot delete another user's session",
			});
		}

		// Delete session from database
		await Session.findByIdAndDelete(sessionIdToDelete);

		res.status(200).json({
			success: true,
			message: "Session deleted successfully",
		});
	} catch (error) {
		console.error("Delete session error:", error);
		res.status(500).json({
			success: false,
			message: "Failed to delete session",
			...(process.env.NODE_ENV === "development" && { error: error.message }),
		});
	}
};

// Logout from all devices controller
export const logoutAll = async (req, res) => {
	try {
		const userId = req.user._id;

		// Find all sessions for authenticated user
		const result = await Session.deleteMany({ userId });

		// Clear current sessionId cookie
		res.cookie("sessionId", "", {
			...cookieConfig,
			maxAge: 0,
		});

		res.status(200).json({
			success: true,
			message: "Logged out from all devices successfully",
			data: {
				terminatedSessions: result.deletedCount,
			},
		});
	} catch (error) {
		console.error("Logout all error:", error);
		res.status(500).json({
			success: false,
			message: "Failed to logout from all devices",
			...(process.env.NODE_ENV === "development" && { error: error.message }),
		});
	}
};

// Validate token controller
export const validateToken = async (req, res) => {
	try {
		const user = req.user;

		const userResponse = user.toObject();
		delete userResponse.password;

		res.status(200).json({
			success: true,
			data: {
				user: userResponse,
			},
		});
	} catch (error) {
		console.error("Validate token error:", error);
		res.status(500).json({
			success: false,
			message: "Token validation failed",
		});
	}
};
