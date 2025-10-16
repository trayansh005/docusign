import express from "express";
import { authenticateToken } from "../middleware/auth.js";
import { listUsers } from "../controllers/userController.js";

const router = express.Router();

router.get("/", authenticateToken, listUsers);

export default router;
