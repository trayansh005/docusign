import express from "express";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import {
	uploadSignatureFile,
	createSignatureFromDataUrl,
	listSignatures,
	deleteSignature,
	setDefaultSignature,
} from "../controllers/signatureController.js";
import { authenticateSession } from "../middleware/sessionAuth.js";
import { requireActiveSubscription } from "../middleware/requireSubscription.js";

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Temp storage for multer (files will be moved by controller)
const tmpDir = path.join(__dirname, "..", "uploads", "temp");
const storage = multer.diskStorage({
	destination: tmpDir,
	filename: (req, file, cb) => cb(null, file.originalname),
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

// Authentication middleware expected on req.user
// Require an active subscription for signature creation endpoints
router.post(
	"/upload",
	authenticateSession,
	requireActiveSubscription,
	upload.single("file"),
	uploadSignatureFile
);
router.post("/from-dataurl", authenticateSession, requireActiveSubscription, createSignatureFromDataUrl);
router.get("/", authenticateSession, listSignatures);
router.delete("/:id", authenticateSession, deleteSignature);
router.post("/:id/default", authenticateSession, setDefaultSignature);

export default router;
