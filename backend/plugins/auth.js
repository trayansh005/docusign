import fp from "fastify-plugin";
import Session from "../models/Session.js";
import User from "../models/User.js";

async function fastifyAuth(fastify, options) {
  fastify.decorate("authenticate", async function (request, reply) {
    try {
      const sessionId = request.cookies.sessionId;

      if (!sessionId) {
        request.log.warn("Auth check failed: No sessionId cookie");
        return reply.status(401).send({
          success: false,
          message: "Session required",
        });
      }

      const session = await Session.findBySessionId(sessionId);

      if (!session) {
        request.log.warn({ sessionId }, "Auth check failed: Session not found in DB");
        return reply.status(401).send({
          success: false,
          message: "Invalid session",
        });
      }

      if (!session.isActive) {
        request.log.warn({ sessionId }, "Auth check failed: Session is inactive");
        return reply.status(401).send({
          success: false,
          message: "Session terminated",
        });
      }

      if (session.isExpired()) {
        request.log.warn({ sessionId, expiresAt: session.expiresAt }, "Auth check failed: Session expired");
        return reply.status(401).send({
          success: false,
          message: "Session expired",
        });
      }

      const user = await User.findById(session.userId);

      if (!user) {
        request.log.error({ userId: session.userId }, "Auth check failed: User not found for session");
        return reply.status(401).send({
          success: false,
          message: "User not found",
        });
      }

      if (!user.isActive) {
        request.log.warn({ userId: user._id }, "Auth check failed: Account is inactive");
        return reply.status(401).send({
          success: false,
          message: "Account is inactive",
        });
      }

      // Update lastActivity and extend expiresAt by 7 days
      session.extend(7).catch((err) => {
        request.log.error({ err }, "Failed to extend session");
      });

      request.user = user;
      request.session = session;
    } catch (error) {
      request.log.error({ err: error }, "Session authentication global error");
      return reply.status(500).send({
        success: false,
        message: "Authentication error",
      });
    }
  });
}

export default fp(fastifyAuth);
