import Session from "../models/Session.js";
import User from "../models/User.js";

/**
 * Middleware to authenticate requests using session-based authentication
 * Validates session from httpOnly cookie and attaches user to request
 */
export const authenticateSession = async (req, res, next) => {
    try {
        // Extract sessionId from httpOnly cookie
        const sessionId = req.cookies?.sessionId;

        if (!sessionId) {
            return res.status(401).json({
                success: false,
                message: "Session required",
            });
        }

        // Query database to find session by sessionId
        const session = await Session.findBySessionId(sessionId);

        if (!session) {
            return res.status(401).json({
                success: false,
                message: "Invalid session",
            });
        }

        // Validate session is active
        if (!session.isActive) {
            return res.status(401).json({
                success: false,
                message: "Session terminated",
            });
        }

        // Check if session has expired
        if (session.isExpired()) {
            return res.status(401).json({
                success: false,
                message: "Session expired",
            });
        }

        // Fetch user from database
        const user = await User.findById(session.userId);

        if (!user) {
            return res.status(401).json({
                success: false,
                message: "User not found",
            });
        }

        // Check if user account is active
        if (!user.isActive) {
            return res.status(401).json({
                success: false,
                message: "Account is inactive",
            });
        }

        // Update lastActivity and extend expiresAt by 7 days
        // Using async operation without blocking the request
        session.extend(7).catch((err) => {
            console.error("Failed to extend session:", err);
        });

        // Attach user to request object
        req.user = user;
        req.session = session;

        // Continue to next middleware
        next();
    } catch (error) {
        console.error("Session authentication error:", error);
        return res.status(500).json({
            success: false,
            message: "Authentication error",
        });
    }
};
