import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { v4 as uuidv4 } from "uuid";
import Signature from "../models/Signature.js";
import User from "../models/User.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const UPLOADS_BASE = path.join(__dirname, "..", "uploads", "signatures", "users");

async function ensureUserDir(userId) {
	const dir = path.join(UPLOADS_BASE, String(userId));
	await fs.promises.mkdir(dir, { recursive: true });
	return dir;
}

export const uploadSignatureFile = async (req, res) => {
	try {
		if (!req.user) return res.status(401).json({ success: false, message: "Unauthorized" });
		if (!req.file) return res.status(400).json({ success: false, message: "No file uploaded" });

		const userId = req.user.id || req.user._id;
		const userDir = await ensureUserDir(userId);

		const ext = path.extname(req.file.originalname) || ".png";
		const filename = `${uuidv4()}${ext}`;
		const destPath = path.join(userDir, filename);

		await fs.promises.rename(req.file.path, destPath);

		const sign = await Signature.create({
			owner: userId,
			filename: `/uploads/signatures/users/${userId}/${filename}`,
			originalName: req.file.originalname,
			mimeType: req.file.mimetype,
			size: req.file.size,
			type: "uploaded",
		});

		return res.status(201).json({ success: true, data: sign });
	} catch (error) {
		console.error("uploadSignatureFile error", error);
		return res.status(500).json({ success: false, message: error.message || "Upload failed" });
	}
};

export const createSignatureFromDataUrl = async (req, res) => {
	try {
		if (!req.user) return res.status(401).json({ success: false, message: "Unauthorized" });
		const { dataUrl, label, fontId } = req.body || {};
		if (!dataUrl || typeof dataUrl !== "string")
			return res.status(400).json({ success: false, message: "Missing dataUrl" });

		const userId = req.user.id || req.user._id;
		const userDir = await ensureUserDir(userId);
		const matches = dataUrl.match(/^data:(image\/[a-zA-Z+.-]+);base64,(.*)$/);
		if (!matches) return res.status(400).json({ success: false, message: "Invalid data URL" });
		const mimeType = matches[1];
		const b64 = matches[2];
		const buf = Buffer.from(b64, "base64");

		const ext = mimeType.split("/")[1] || "png";
		const filename = `${uuidv4()}.${ext}`;
		const destPath = path.join(userDir, filename);

		await fs.promises.writeFile(destPath, buf);

		const sign = await Signature.create({
			owner: userId,
			filename: `/uploads/signatures/users/${userId}/${filename}`,
			originalName: filename,
			mimeType,
			size: buf.length,
			type: "typed",
			fontId: fontId || null,
			label: label || "",
		});

		return res.status(201).json({ success: true, data: sign });
	} catch (error) {
		console.error("createSignatureFromDataUrl error", error);
		return res
			.status(500)
			.json({ success: false, message: error.message || "Failed to create signature" });
	}
};

export const listSignatures = async (req, res) => {
	try {
		if (!req.user) return res.status(401).json({ success: false, message: "Unauthorized" });
		const userId = req.user.id || req.user._id;
		const signatures = await Signature.find({ owner: userId }).sort({ createdAt: -1 });
		return res.status(200).json({ success: true, data: signatures });
	} catch (error) {
		console.error("listSignatures error", error);
		return res
			.status(500)
			.json({ success: false, message: error.message || "Failed to list signatures" });
	}
};

export const deleteSignature = async (req, res) => {
	try {
		if (!req.user) return res.status(401).json({ success: false, message: "Unauthorized" });
		const userId = req.user.id || req.user._id;
		const { id } = req.params;
		const sig = await Signature.findById(id);
		if (!sig) return res.status(404).json({ success: false, message: "Signature not found" });
		if (String(sig.owner) !== String(userId))
			return res.status(403).json({ success: false, message: "Forbidden" });

		// delete file
		try {
			const filePath = path.join(__dirname, "..", sig.filename.replace(/^[\\/]+/, ""));
			if (fs.existsSync(filePath)) await fs.promises.unlink(filePath);
		} catch (e) {
			console.warn("deleteSignature file delete failed", e?.message || e);
		}

		await sig.deleteOne();
		return res.status(200).json({ success: true, message: "Deleted" });
	} catch (error) {
		console.error("deleteSignature error", error);
		return res
			.status(500)
			.json({ success: false, message: error.message || "Failed to delete signature" });
	}
};

export const setDefaultSignature = async (req, res) => {
	try {
		if (!req.user) return res.status(401).json({ success: false, message: "Unauthorized" });
		const userId = req.user.id || req.user._id;
		const { id } = req.params;
		const sig = await Signature.findById(id);
		if (!sig) return res.status(404).json({ success: false, message: "Signature not found" });
		if (String(sig.owner) !== String(userId))
			return res.status(403).json({ success: false, message: "Forbidden" });

		// unset others
		await Signature.updateMany({ owner: userId, _id: { $ne: id } }, { $set: { isDefault: false } });
		sig.isDefault = true;
		await sig.save();

		return res.status(200).json({ success: true, data: sig });
	} catch (error) {
		console.error("setDefaultSignature error", error);
		return res
			.status(500)
			.json({ success: false, message: error.message || "Failed to set default" });
	}
};
