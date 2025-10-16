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
import { authenticateToken } from "../middleware/auth.js";
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
	authenticateToken,
	requireActiveSubscription,
	upload.single("file"),
	uploadSignatureFile
);
router.post("/from-dataurl", authenticateToken, requireActiveSubscription, createSignatureFromDataUrl);
router.get("/", authenticateToken, listSignatures);
router.delete("/:id", authenticateToken, deleteSignature);
router.post("/:id/default", authenticateToken, setDefaultSignature);

export default router;
