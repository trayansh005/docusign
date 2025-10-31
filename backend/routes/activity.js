import express from "express";
import { authenticateSession } from "../middleware/sessionAuth.js";
import { getRecentActivities, getDocuSignActivities } from "../controllers/activityController.js";

const router = express.Router();

// Get recent activities for the authenticated user
router.get("/recent", authenticateSession, getRecentActivities);

// Get DocuSign activities with filtering and pagination
router.get("/docusign", authenticateSession, getDocuSignActivities);

export default router;
