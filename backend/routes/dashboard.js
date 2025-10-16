import express from "express";
import { authenticateToken } from "../middleware/auth.js";
import { getUserStats, getInbox } from "../controllers/dashboardController.js";

const router = express.Router();

router.get("/stats", authenticateToken, getUserStats);
router.get("/inbox", authenticateToken, getInbox);

export default router;
