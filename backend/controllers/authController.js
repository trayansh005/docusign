import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { generateTokens, setAuthCookies, clearAuthCookies } from "../utils/auth.js";
import { parseDeviceName } from "../utils/deviceParser.js";

// Register
export const register = async (request, reply) => {
  try {
    const { firstName, lastName, email, password, phoneNumber, company } = request.body;

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return reply.status(409).send({ success: false, message: "User with this email already exists" });
    }

    const user = new User({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.toLowerCase().trim(),
      password,
      phoneNumber: phoneNumber?.trim(),
      company: company?.trim(),
    });

    await user.save();
    user.lastLogin = new Date();
    await user.save();

    const { accessToken, refreshToken } = generateTokens(user);
    setAuthCookies(reply, accessToken, refreshToken);

    const userResponse = user.toObject();
    delete userResponse.password;

    return reply.status(201).send({
      success: true,
      message: "User registered and logged in successfully",
      data: { user: userResponse },
    });
  } catch (error) {
    request.log.error("Registration error:", error);
    return reply.status(500).send({ success: false, message: "Registration failed" });
  }
};

// Login
export const login = async (request, reply) => {
  try {
    const { email, password, rememberMe } = request.body;

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return reply.status(401).send({ success: false, message: "Invalid credentials" });
    }

    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return reply.status(401).send({ success: false, message: "Invalid credentials" });
    }

    user.lastLogin = new Date();
    await user.save();

    const { accessToken, refreshToken } = generateTokens(user, rememberMe);
    setAuthCookies(reply, accessToken, refreshToken, rememberMe);

    request.log.info({ userId: user._id.toString() }, "Login successful");

    const userResponse = user.toObject();
    delete userResponse.password;

    return reply.status(200).send({
      success: true,
      message: "Login successful",
      data: { user: userResponse },
    });
  } catch (error) {
    request.log.error("Login error:", error);
    return reply.status(500).send({ success: false, message: "Login failed" });
  }
};

// Refresh token
export const refreshToken = async (request, reply) => {
  const token = request.cookies?.refreshToken;

  if (!token) {
    return reply.status(401).send({ success: false, message: "Refresh token missing" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select("-password");

    if (!user) {
      return reply.status(401).send({ success: false, message: "User not found" });
    }

    const { accessToken, refreshToken: newRefreshToken } = generateTokens(user);
    setAuthCookies(reply, accessToken, newRefreshToken);

    return reply.status(200).send({ success: true, message: "Token refreshed" });
  } catch (error) {
    clearAuthCookies(reply);
    return reply.status(401).send({ success: false, message: "Invalid refresh token" });
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
    const updateData = {};
    if (firstName) updateData.firstName = firstName.trim();
    if (lastName) updateData.lastName = lastName.trim();
    if (phoneNumber) updateData.phoneNumber = phoneNumber.trim();
    if (company) updateData.company = company.trim();

    const user = await User.findByIdAndUpdate(
      request.user._id,
      { $set: updateData },
      { new: true, runValidators: true },
    ).select("-password");

    return { success: true, message: "Profile updated successfully", data: { user } };
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

    const isValid = await user.comparePassword(currentPassword);
    if (!isValid) {
      return reply.status(401).send({ success: false, message: "Current password is incorrect" });
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
  clearAuthCookies(reply);
  return { success: true, message: "Logged out successfully" };
};

// Logout all — JWT is stateless so we just clear cookies on this device.
// For true multi-device revocation a token blacklist would be needed.
export const logoutAll = async (request, reply) => {
  clearAuthCookies(reply);
  return { success: true, message: "Logged out from all devices" };
};

// Validate token (used by some routes)
export const validateToken = async (request, reply) => {
  const userResponse = request.user.toObject();
  delete userResponse.password;
  return { success: true, data: { user: userResponse } };
};
