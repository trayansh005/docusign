import express from "express";
import { authenticateToken } from "../middleware/auth.js";
import { getUserStats, getInbox, getPendingDocumentsCount } from "../controllers/dashboardController.js";

const router = express.Router();

router.get("/stats", authenticateToken, getUserStats);
router.get("/inbox", authenticateToken, getInbox);
router.get("/pending-count", authenticateToken, getPendingDocumentsCount);

export default router;
