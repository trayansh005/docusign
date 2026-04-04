import { authenticateSession } from "../middleware/sessionAuth.js";
import { requireActiveSubscription } from "../middleware/requireSubscription.js";
import {
  uploadSignatureFile,
  createSignatureFromDataUrl,
  listSignatures,
  deleteSignature,
  setDefaultSignature,
} from "../controllers/signatureController.js";

/**
 * Signature routes Fastify plugin
 */
export default async function signatureRoutes(fastify, options) {
  // Apply authentication and subscription check to all routes in this plugin
  fastify.addHook("preHandler", authenticateSession);

  // Routes for signature creation
  fastify.register(async function (protectedRoutes) {
    protectedRoutes.addHook("preHandler", requireActiveSubscription);

    protectedRoutes.post("/upload", uploadSignatureFile);
    protectedRoutes.post("/from-dataurl", createSignatureFromDataUrl);
  });

  // General signature management
  fastify.get("/", listSignatures);
  fastify.delete("/:id", deleteSignature);
  fastify.post("/:id/default", setDefaultSignature);
}

