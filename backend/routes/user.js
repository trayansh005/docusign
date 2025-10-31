import express from "express";
import { authenticateSession } from "../middleware/sessionAuth.js";
import { listUsers } from "../controllers/userController.js";

const router = express.Router();

router.get("/", authenticateSession, listUsers);

export default router;
