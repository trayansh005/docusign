import jwt from "jsonwebtoken";
import Session from "../models/Session.js";
import User from "../models/User.js";

/**
 * Middleware to authenticate requests using session-based or token-based authentication
 * Supporting both legacy sessions and new Bearer tokens for mirroring Fomiq pattern.
 */
export const authenticateSession = async (request, reply) => {
  try {
    let user = null;
    let session = null;

    // 1. Check for Bearer token first (New Fomiq-mirrored pattern)
    const authHeader = request.headers.authorization || request.headers.Authorization;
    
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.substring(7);
      if (token && token !== "undefined" && token !== "null") {
        try {
          const JWT_SECRET = process.env.JWT_SECRET;
          if (!JWT_SECRET) {
            request.log.error("JWT_SECRET is not set in environment");
          } else {
            const decoded = jwt.verify(token, JWT_SECRET);
            // Support both 'id' and 'userId' in payload
            const userId = decoded.id || decoded.userId;
            
            if (userId) {
              user = await User.findById(userId).select("-password");
              if (user) {
                request.log.info({ userId: user._id }, "Authenticated via Bearer token");
              } else {
                request.log.warn({ userId }, "User from token not found in database");
              }
            } else {
              request.log.warn("Token decoded successfully but contained no user ID");
            }
          }
        } catch (err) {
          request.log.warn({ error: err.message }, "Bearer token verification failed");
        }
      }
    }

    // 2. Fallback to Legacy Session (if no valid user from token)
    if (!user) {
      const sessionId = request.cookies?.sessionId;
      if (sessionId) {
        session = await Session.findBySessionId(sessionId);
        if (session && session.isActive && !session.isExpired()) {
          user = await User.findById(session.userId);
          if (user) {
            request.log.info({ userId: user._id }, "Authenticated via Legacy Session");
            // Extend session
            session.extend(7).catch((err) => request.log.error("Failed to extend session:", err));
          }
        }
      }
    }

    if (!user) {
      request.log.warn({ 
        hasAuthHeader: !!authHeader, 
        hasSessionId: !!request.cookies?.sessionId 
      }, "Authentication failed: No valid token or session");
      
      return reply.status(401).send({
        success: false,
        message: "Session required",
      });
    }

    if (!user.isActive) {
      return reply.status(401).send({
        success: false,
        message: "Account is inactive",
      });
    }

    request.user = user;
    if (session) request.session = session;
  } catch (error) {
    request.log.error("Session authentication error:", error);
    return reply.status(500).send({
      success: false,
      message: "Authentication error",
    });
  }
};

