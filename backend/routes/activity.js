import { getRecentActivities, getDocuSignActivities } from "../controllers/activityController.js";

export default async function activityRoutes(fastify, options) {
  fastify.addHook("preHandler", fastify.authenticate);

  // Get recent activities for the authenticated user
  fastify.get("/recent", getRecentActivities);

  // Get DocuSign activities with filtering and pagination
  fastify.get("/docusign", getDocuSignActivities);
}

