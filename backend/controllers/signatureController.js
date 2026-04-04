import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { v4 as uuidv4 } from "uuid";
import Signature from "../models/Signature.js";
import { pipeline } from "stream/promises";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const UPLOADS_BASE = path.join(__dirname, "..", "uploads", "signatures", "users");

async function ensureUserDir(userId) {
  const dir = path.join(UPLOADS_BASE, String(userId));
  if (!fs.existsSync(dir)) {
    await fs.promises.mkdir(dir, { recursive: true });
  }
  return dir;
}

export const uploadSignatureFile = async (request, reply) => {
  try {
    const userId = request.user?.id || request.user?._id;
    if (!userId) return reply.status(401).send({ success: false, message: "Unauthorized" });

    const data = await request.file();
    if (!data) return reply.status(400).send({ success: false, message: "No file uploaded" });

    const userDir = await ensureUserDir(userId);
    const ext = path.extname(data.filename) || ".png";
    const filename = `${uuidv4()}${ext}`;
    const destPath = path.join(userDir, filename);

    await pipeline(data.file, fs.createWriteStream(destPath));

    const sign = await Signature.create({
      owner: userId,
      filename: `/uploads/signatures/users/${userId}/${filename}`,
      originalName: data.filename,
      mimeType: data.mimetype,
      size: fs.statSync(destPath).size,
      type: "uploaded",
    });

    return reply.status(201).send({ success: true, data: sign });
  } catch (error) {
    request.log.error("uploadSignatureFile error", error);
    return reply.status(500).send({ success: false, message: error.message || "Upload failed" });
  }
};

export const createSignatureFromDataUrl = async (request, reply) => {
  try {
    const userId = request.user?.id || request.user?._id;
    if (!userId) return reply.status(401).send({ success: false, message: "Unauthorized" });

    const { dataUrl, label, fontId } = request.body || {};
    if (!dataUrl || typeof dataUrl !== "string") {
      return reply.status(400).send({ success: false, message: "Missing dataUrl" });
    }

    const userDir = await ensureUserDir(userId);
    const matches = dataUrl.match(/^data:(image\/[a-zA-Z+.-]+);base64,(.*)$/);
    if (!matches) return reply.status(400).send({ success: false, message: "Invalid data URL" });
    
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

    return reply.status(201).send({ success: true, data: sign });
  } catch (error) {
    request.log.error("createSignatureFromDataUrl error", error);
    return reply.status(500).send({ success: false, message: error.message || "Failed to create signature" });
  }
};

export const listSignatures = async (request, reply) => {
  try {
    const userId = request.user?.id || request.user?._id;
    if (!userId) return reply.status(401).send({ success: false, message: "Unauthorized" });

    const signatures = await Signature.find({ owner: userId }).sort({ createdAt: -1 });
    return { success: true, data: signatures };
  } catch (error) {
    request.log.error("listSignatures error", error);
    return reply.status(500).send({ success: false, message: "Failed to list signatures" });
  }
};

export const deleteSignature = async (request, reply) => {
  try {
    const userId = request.user?.id || request.user?._id;
    if (!userId) return reply.status(401).send({ success: false, message: "Unauthorized" });

    const { id } = request.params;
    const sig = await Signature.findById(id);
    if (!sig) return reply.status(404).send({ success: false, message: "Signature not found" });
    
    if (String(sig.owner) !== String(userId)) {
      return reply.status(403).send({ success: false, message: "Forbidden" });
    }

    try {
      const filePath = path.join(__dirname, "..", sig.filename.replace(/^[\\/]+/, ""));
      if (fs.existsSync(filePath)) await fs.promises.unlink(filePath);
    } catch (e) {
      request.log.warn("deleteSignature file delete failed", e?.message || e);
    }

    await sig.deleteOne();
    return { success: true, message: "Deleted" };
  } catch (error) {
    request.log.error("deleteSignature error", error);
    return reply.status(500).send({ success: false, message: "Failed to delete signature" });
  }
};

export const setDefaultSignature = async (request, reply) => {
  try {
    const userId = request.user?.id || request.user?._id;
    if (!userId) return reply.status(401).send({ success: false, message: "Unauthorized" });

    const { id } = request.params;
    const sig = await Signature.findById(id);
    if (!sig) return reply.status(404).send({ success: false, message: "Signature not found" });

    if (String(sig.owner) !== String(userId)) {
      return reply.status(403).send({ success: false, message: "Forbidden" });
    }

    await Signature.updateMany({ owner: userId, _id: { $ne: id } }, { $set: { isDefault: false } });
    sig.isDefault = true;
    await sig.save();

    return { success: true, data: sig };
  } catch (error) {
    request.log.error("setDefaultSignature error", error);
    return reply.status(500).send({ success: false, message: "Failed to set default" });
  }
};

