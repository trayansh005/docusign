import Session from "../models/Session.js";
import User from "../models/User.js";

/**
 * Middleware to authenticate requests using session-based authentication
 * Validates session from httpOnly cookie and attaches user to request
 */
export const authenticateSession = async (request, reply) => {
  try {
    const sessionId = request.cookies?.sessionId;

    if (!sessionId) {
      return reply.status(401).send({
        success: false,
        message: "Session required",
      });
    }

    const session = await Session.findBySessionId(sessionId);

    if (!session) {
      return reply.status(401).send({
        success: false,
        message: "Invalid session",
      });
    }

    if (!session.isActive) {
      return reply.status(401).send({
        success: false,
        message: "Session terminated",
      });
    }

    if (session.isExpired()) {
      return reply.status(401).send({
        success: false,
        message: "Session expired",
      });
    }

    const user = await User.findById(session.userId);

    if (!user) {
      return reply.status(401).send({
        success: false,
        message: "User not found",
      });
    }

    if (!user.isActive) {
      return reply.status(401).send({
        success: false,
        message: "Account is inactive",
      });
    }

    // Update lastActivity and extend expiresAt by 7 days
    session.extend(7).catch((err) => {
      request.log.error("Failed to extend session:", err);
    });

    request.user = user;
    request.session = session;
  } catch (error) {
    request.log.error("Session authentication error:", error);
    return reply.status(500).send({
      success: false,
      message: "Authentication error",
    });
  }
};

