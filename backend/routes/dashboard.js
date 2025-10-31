import express from "express";
import { authenticateSession } from "../middleware/sessionAuth.js";
import { getUserStats, getInbox, getPendingDocumentsCount, markNotificationsRead } from "../controllers/dashboardController.js";

const router = express.Router();

router.get("/stats", authenticateSession, getUserStats);
router.get("/inbox", authenticateSession, getInbox);
router.get("/pending-count", authenticateSession, getPendingDocumentsCount);
router.post("/mark-notifications-read", authenticateSession, markNotificationsRead);

export default router;
