import fp from "fastify-plugin";
import jwt from "jsonwebtoken";
import User from "../models/User.js";

async function fastifyAuth(fastify, options) {
  fastify.decorate("authenticate", async function (request, reply) {
    const JWT_SECRET = process.env.JWT_SECRET;
    if (!JWT_SECRET) {
      request.log.error("JWT_SECRET is not set");
      return reply.status(503).send({ success: false, message: "Server misconfigured" });
    }

    const token = request.cookies?.accessToken;

    if (!token) {
      return reply.status(401).send({ success: false, message: "Access token required" });
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET);

      const user = await User.findById(decoded.id).select("-password");
      if (!user) {
        return reply.status(401).send({ success: false, message: "User not found" });
      }

      if (!user.isActive) {
        return reply.status(401).send({ success: false, message: "Account is inactive" });
      }

      request.user = user;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        return reply.status(401).send({ success: false, message: "Token expired", needsRefresh: true });
      }
      return reply.status(401).send({ success: false, message: "Invalid token" });
    }
  });
}

export default fp(fastifyAuth);
