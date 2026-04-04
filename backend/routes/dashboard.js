import { authenticateSession } from "../middleware/sessionAuth.js";
import { getUserStats, getInbox, getPendingDocumentsCount, markNotificationsRead } from "../controllers/dashboardController.js";

/**
 * Dashboard routes Fastify plugin
 */
export default async function dashboardRoutes(fastify, options) {
  // Apply authentication to all routes in this plugin
  fastify.addHook("preHandler", authenticateSession);

  fastify.get("/stats", getUserStats);
  fastify.get("/inbox", getInbox);
  fastify.get("/pending-count", getPendingDocumentsCount);
  fastify.post("/mark-notifications-read", markNotificationsRead);
}

