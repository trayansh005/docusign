import express from "express";
import { authenticateToken } from "../middleware/auth.js";
import { getRecentActivities, getDocuSignActivities } from "../controllers/activityController.js";

const router = express.Router();

// Get recent activities for the authenticated user
router.get("/recent", authenticateToken, getRecentActivities);

// Get DocuSign activities with filtering and pagination
router.get("/docusign", authenticateToken, getDocuSignActivities);

export default router;
