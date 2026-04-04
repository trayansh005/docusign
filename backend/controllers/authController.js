import crypto from "crypto";
import User from "../models/User.js";
import Session from "../models/Session.js";
import { parseDeviceName } from "../utils/deviceParser.js";

// Session duration in seconds (Max-Age header is in seconds, not ms)
const SESSION_MAX_AGE = 7 * 24 * 60 * 60; // 7 days

/**
 * Build cookie options at request-time.
 *
 * Domain strategy:
 *  - Explicit COOKIE_DOMAIN env var always wins (e.g. ".fomiqsign.com").
 *  - In production with no env var, derive the root domain from the request
 *    Origin header so the cookie is shared across all subdomains
 *    (fomiqsign.com ↔ api.fomiqsign.com).
 *  - In development, omit domain so the cookie is scoped to localhost.
 */
function buildCookieConfig(request) {
  let domain = process.env.COOKIE_DOMAIN || undefined;

  if (!domain && process.env.NODE_ENV === "production") {
    // Derive root domain from Origin, e.g. "https://fomiqsign.com" → ".fomiqsign.com"
    const origin = request.headers["origin"] || request.headers["referer"] || "";
    try {
      const hostname = new URL(origin).hostname;
      // Strip leading subdomain to get the registrable domain, then prefix with "."
      // e.g. "api.fomiqsign.com" → ".fomiqsign.com", "fomiqsign.com" → ".fomiqsign.com"
      const parts = hostname.split(".");
      domain = parts.length > 2
        ? "." + parts.slice(-2).join(".")
        : "." + hostname;
    } catch {
      // Origin header missing or malformed — fall back to no domain restriction
    }
  }

  return {
    httpOnly: true,
    secure: process.env.COOKIE_SECURE !== undefined
      ? String(process.env.COOKIE_SECURE).toLowerCase() === "true"
      : process.env.NODE_ENV === "production",
    sameSite: process.env.COOKIE_SAMESITE || "lax",
    domain,
    path: "/",
  };
}

// Register controller
export const register = async (request, reply) => {
  try {
    const { firstName, lastName, email, password, phoneNumber, company } = request.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return reply.status(409).send({
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

    // Auto-login after registration
    const sessionId = crypto.randomUUID();
    const userAgent = request.headers["user-agent"] || "Unknown";
    const ip = request.ip || "Unknown";
    const deviceName = parseDeviceName(userAgent);

    const session = new Session({
      sessionId,
      userId: user._id,
      deviceInfo: { userAgent, ip, deviceName },
      expiresAt: new Date(Date.now() + SESSION_MAX_AGE * 1000),
    });

    await session.save();

    user.lastLogin = new Date();
    await user.save();

    reply.setCookie("sessionId", sessionId, {
      ...buildCookieConfig(request),
      maxAge: SESSION_MAX_AGE,
    });

    const userResponse = user.toObject();
    delete userResponse.password;

    return reply.status(201).send({
      success: true,
      message: "User registered and logged in successfully",
      data: { user: userResponse },
    });
  } catch (error) {
    request.log.error("Registration error:", error);
    return reply.status(500).send({
      success: false,
      message: "Registration failed",
    });
  }
};

// Login controller
export const login = async (request, reply) => {
  try {
    const { email, password, rememberMe } = request.body;

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return reply.status(401).send({
        success: false,
        message: "Invalid credentials",
      });
    }

    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return reply.status(401).send({
        success: false,
        message: "Invalid credentials",
      });
    }

    const sessionId = crypto.randomUUID();
    const userAgent = request.headers["user-agent"] || "Unknown";
    const ip = request.ip || "Unknown";
    const deviceName = parseDeviceName(userAgent);

    // rememberMe extends session to 30 days, otherwise 7 days
    const sessionDuration = rememberMe ? 30 * 24 * 60 * 60 : SESSION_MAX_AGE;

    const session = new Session({
      sessionId,
      userId: user._id,
      deviceInfo: { userAgent, ip, deviceName },
      expiresAt: new Date(Date.now() + sessionDuration * 1000),
    });

    await session.save();

    user.lastLogin = new Date();
    await user.save();

    reply.setCookie("sessionId", sessionId, {
      ...buildCookieConfig(request),
      maxAge: sessionDuration,
    });

    const userResponse = user.toObject();
    delete userResponse.password;

    return reply.status(200).send({
      success: true,
      message: "Login successful",
      data: { user: userResponse },
    });
  } catch (error) {
    request.log.error("Login error:", error);
    return reply.status(500).send({
      success: false,
      message: "Login failed",
    });
  }
};

// Get profile
export const getProfile = async (request, reply) => {
  const userResponse = request.user.toObject();
  delete userResponse.password;
  return { success: true, data: { user: userResponse } };
};

// Update profile
export const updateProfile = async (request, reply) => {
  try {
    const { firstName, lastName, phoneNumber, company } = request.body;
    const userId = request.user._id;

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

    return {
      success: true,
      message: "Profile updated successfully",
      data: { user },
    };
  } catch (error) {
    request.log.error("Update profile error:", error);
    return reply.status(500).send({ success: false, message: "Update failed" });
  }
};

// Change password
export const changePassword = async (request, reply) => {
  try {
    const { currentPassword, newPassword } = request.body;
    const user = await User.findById(request.user._id);

    const isCurrentPasswordValid = await user.comparePassword(currentPassword);
    if (!isCurrentPasswordValid) {
      return reply.status(401).send({
        success: false,
        message: "Current password is incorrect",
      });
    }

    user.password = newPassword;
    await user.save();

    return { success: true, message: "Password changed successfully" };
  } catch (error) {
    request.log.error("Change password error:", error);
    return reply.status(500).send({ success: false, message: "Change password failed" });
  }
};

// Logout
export const logout = async (request, reply) => {
  try {
    const sessionId = request.cookies.sessionId;
    if (sessionId) {
      await Session.findOneAndDelete({ sessionId });
    }
    reply.setCookie("sessionId", "", { ...buildCookieConfig(request), maxAge: 0 });
    return { success: true, message: "Logged out successfully" };
  } catch (error) {
    request.log.error("Logout error:", error);
    return reply.status(500).send({ success: false, message: "Logout failed" });
  }
};

// Get sessions
export const getSessions = async (request, reply) => {
  try {
    const userId = request.user._id;
    const currentSessionId = request.cookies.sessionId;

    const sessions = await Session.find({ userId, isActive: true })
      .sort({ lastActivity: -1 })
      .lean();

    const sessionList = sessions.map((session) => ({
      id: session._id.toString(),
      deviceInfo: session.deviceInfo,
      createdAt: session.createdAt,
      lastActivity: session.lastActivity,
      expiresAt: session.expiresAt,
      isCurrentSession: session.sessionId === currentSessionId,
    }));

    return { success: true, data: { sessions: sessionList } };
  } catch (error) {
    request.log.error("Get sessions error:", error);
    return reply.status(500).send({ success: false, message: "Failed to fetch sessions" });
  }
};

// Delete session
export const deleteSession = async (request, reply) => {
  try {
    const { sessionId } = request.params;
    const session = await Session.findById(sessionId);

    if (!session || session.userId.toString() !== request.user._id.toString()) {
      return reply.status(403).send({ success: false, message: "Unauthorized or not found" });
    }

    await Session.findByIdAndDelete(sessionId);
    return { success: true, message: "Session deleted successfully" };
  } catch (error) {
    request.log.error("Delete session error:", error);
    return reply.status(500).send({ success: false, message: "Failed to delete session" });
  }
};

// Logout all
export const logoutAll = async (request, reply) => {
  try {
    const result = await Session.deleteMany({ userId: request.user._id });
    reply.setCookie("sessionId", "", { ...buildCookieConfig(request), maxAge: 0 });
    return {
      success: true,
      message: "Logged out from all devices",
      data: { terminatedSessions: result.deletedCount },
    };
  } catch (error) {
    request.log.error("Logout all error:", error);
    return reply.status(500).send({ success: false, message: "Logout all failed" });
  }
};

// Validate token
export const validateToken = async (request, reply) => {
  const userResponse = request.user.toObject();
  delete userResponse.password;
  return { success: true, data: { user: userResponse } };
};

