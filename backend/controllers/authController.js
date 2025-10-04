import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { customValidations } from "../middlewares/validation.js";

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET + "_refresh";

// Cookie configuration
const cookieConfig = {
	httpOnly: true,
	secure: process.env.NODE_ENV === "production",
	sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
	path: "/",
};

// Token expiration times
const ACCESS_TOKEN_EXPIRY = "15m";
const REFRESH_TOKEN_EXPIRY = "7d";
const MAX_REFRESH_TOKENS = 5;

// Generate tokens
const generateTokens = (payload) => {
	const accessToken = jwt.sign(payload, JWT_SECRET, {
		expiresIn: ACCESS_TOKEN_EXPIRY,
	});
	const refreshToken = jwt.sign(payload, JWT_REFRESH_SECRET, {
		expiresIn: REFRESH_TOKEN_EXPIRY,
	});
	return { accessToken, refreshToken };
};

// Helper to clean expired refresh tokens
const cleanExpiredTokens = (refreshTokens) => {
	const now = new Date();
	return refreshTokens.filter((tokenObj) => tokenObj.expires > now);
};

// Helper to manage refresh token storage
const manageRefreshTokens = (user, newRefreshToken) => {
	if (!user.refreshTokens) {
		user.refreshTokens = [];
	}

	// Clean expired tokens first
	user.refreshTokens = cleanExpiredTokens(user.refreshTokens);

	// Add new token
	user.refreshTokens.push({
		token: newRefreshToken,
		expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
		createdAt: new Date(),
	});

	// Keep only the most recent tokens (FIFO)
	if (user.refreshTokens.length > MAX_REFRESH_TOKENS) {
		user.refreshTokens = user.refreshTokens
			.sort((a, b) => b.createdAt - a.createdAt)
			.slice(0, MAX_REFRESH_TOKENS);
	}
};

// Helper function to set auth cookies
const setAuthCookies = (res, accessToken, refreshToken) => {
	res.cookie("accessToken", accessToken, {
		...cookieConfig,
		maxAge: 15 * 60 * 1000, // 15 minutes
	});
	res.cookie("refreshToken", refreshToken, {
		...cookieConfig,
		maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
	});
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

		// Remove password from response
		const userResponse = user.toObject();
		delete userResponse.password;

		res.status(201).json({
			success: true,
			message: "User registered successfully",
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

// Login controller with enhanced features
export const login = async (req, res) => {
	try {
		const { email, password, userType = "user" } = req.body;

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

		// Create token payload
		const tokenPayload = {
			id: user._id,
			firstName: user.firstName,
			lastName: user.lastName,
			email: user.email,
			userType: userType,
		};

		// Generate tokens
		const { accessToken, refreshToken } = generateTokens(tokenPayload);

		// Store refresh token in the database
		manageRefreshTokens(user, refreshToken);

		// Update last login
		user.lastLogin = new Date();
		await user.save();

		// Set cookies
		setAuthCookies(res, accessToken, refreshToken);

		// Prepare user response
		const userResponse = user.toObject();
		delete userResponse.password;
		delete userResponse.refreshTokens;

		res.status(200).json({
			success: true,
			message: "Login successful",
			data: {
				token: accessToken, // For backward compatibility
				accessToken,
				refreshToken,
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

// Refresh token controller
export const refreshToken = async (req, res) => {
	try {
		const { refreshToken: token } = req.cookies || req.body;

		if (!token) {
			return res.status(401).json({
				success: false,
				message: "Refresh token required",
			});
		}

		// Verify refresh token
		const decoded = jwt.verify(token, JWT_REFRESH_SECRET);

		// Find user and validate refresh token
		const user = await User.findById(decoded.id);
		if (!user || !user.refreshTokens?.some((tokenObj) => tokenObj.token === token)) {
			return res.status(401).json({
				success: false,
				message: "Invalid refresh token",
			});
		}

		// Generate new tokens
		const tokenPayload = {
			id: user._id,
			firstName: user.firstName,
			lastName: user.lastName,
			email: user.email,
			userType: decoded.userType,
		};

		const { accessToken, refreshToken: newRefreshToken } = generateTokens(tokenPayload);

		// Replace old refresh token with new one
		user.refreshTokens = user.refreshTokens.filter((tokenObj) => tokenObj.token !== token);
		manageRefreshTokens(user, newRefreshToken);
		await user.save();

		// Set new cookies
		setAuthCookies(res, accessToken, newRefreshToken);

		res.status(200).json({
			success: true,
			data: {
				accessToken,
				refreshToken: newRefreshToken,
			},
		});
	} catch (error) {
		console.error("Refresh token error:", error);
		res.status(401).json({
			success: false,
			message: "Invalid refresh token",
		});
	}
};

// Logout controller
export const logout = async (req, res) => {
	try {
		const { refreshToken: token } = req.cookies || req.body;

		if (token && req.user) {
			// Remove refresh token from database
			const user = await User.findById(req.user.id);
			if (user) {
				user.refreshTokens =
					user.refreshTokens?.filter((tokenObj) => tokenObj.token !== token) || [];
				await user.save();
			}
		}

		// Clear cookies
		res.clearCookie("accessToken", cookieConfig);
		res.clearCookie("refreshToken", cookieConfig);

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

// Validate token controller
export const validateToken = async (req, res) => {
	try {
		const user = req.user;

		const userResponse = user.toObject();
		delete userResponse.password;
		delete userResponse.refreshTokens;

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
