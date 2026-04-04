import "dotenv/config";
import Fastify from "fastify";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import compress from "@fastify/compress";
import cookie from "@fastify/cookie";
import fastifyStatic from "@fastify/static";
import rateLimit from "@fastify/rate-limit";
import multipart from "@fastify/multipart";
import fastifyRawBody from "fastify-raw-body";

// Plugins
import dbPlugin from "./plugins/db.js";
import authPlugin from "./plugins/auth.js";

// Routes
import activityRoutes from "./routes/activity.js";
import authRoutes from "./routes/auth.js";
import dashboardRoutes from "./routes/dashboard.js";
import docusignRoutes from "./routes/docusign.js";
import signatureRoutes from "./routes/signature.js";
import subscriptionRoutes from "./routes/subscription.js";
import userRoutes from "./routes/user.js";
import contactRoutes from "./routes/contact.js";
import testRoutes from "./routes/test.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * 1. Immediate Directory Initialization
 * Ensuring that the uploads folder exists BEFORE any plugins (like @fastify/static)
 * attempt to access it.
 */
const requiredDirs = [
  "uploads",
  "uploads/temp",
  "uploads/signatures",
  "uploads/signatures/templates",
  "uploads/signatures/users"
];

for (const dir of requiredDirs) {
  const dirPath = path.join(__dirname, dir);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    console.log(`[BOOT] Created required directory: ${dir}`);
  }
}

const fastify = Fastify({
  logger: {
    level: "info",
    transport:
      process.env.NODE_ENV === "production"
        ? undefined
        : {
            target: "pino-pretty",
            options: {
              translateTime: "HH:MM:ss Z",
              ignore: "pid,hostname",
            },
          },
  },
  bodyLimit: 1048576 * 20, // 20MB body limit
  // Required for correct IP resolution and cookie handling behind a reverse proxy
  trustProxy: true,
});

// Register Core Plugins
await fastify.register(helmet, {
  contentSecurityPolicy: false,
});
await fastify.register(compress);
await fastify.register(cookie);

// Raw Body for Stripe Webhooks
await fastify.register(fastifyRawBody, {
  field: "rawBody",
  global: false,
  encoding: "utf8",
  runFirst: true,
});

await fastify.register(cors, {
  origin: (origin, callback) => {
    const allowedOrigins = [
      process.env.FRONTEND_URL || "http://localhost:3000",
      "https://fomiqsign.com",
      "http://localhost:3000",
    ];
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"), false);
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "Range", "stripe-signature"],
  exposedHeaders: ["Content-Length", "Content-Range"],
});

// Trust Proxy (Required for rate limiting behind reverse proxy)
// NOTE: trustProxy is already set in the Fastify constructor above.

await fastify.register(rateLimit, {
  max: 100,
  timeWindow: "1 minute",
});

await fastify.register(multipart, {
  limits: {
    fileSize: 20 * 1024 * 1024,
  },
});

// Custom Plugins
await fastify.register(dbPlugin);
await fastify.register(authPlugin);

// Static files
await fastify.register(fastifyStatic, {
  root: path.join(__dirname, "uploads"),
  prefix: "/uploads/",
  decorateReply: false,
});

// Root Route - Health & Connectivity check
fastify.get("/", async (request, reply) => {
  return {
    name: "FomiqSign API",
    version: "1.0.0",
    status: "online",
    environment: process.env.NODE_ENV || "development"
  };
});

// Health check
fastify.get("/api/health", async (request, reply) => {
  return {
    status: "OK",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || "development",
  };
});

// API Routes
await fastify.register(activityRoutes, { prefix: "/api/activity" });
await fastify.register(authRoutes, { prefix: "/api/auth" });
await fastify.register(dashboardRoutes, { prefix: "/api/dashboard" });
await fastify.register(docusignRoutes, { prefix: "/api/docusign" });
await fastify.register(signatureRoutes, { prefix: "/api/signature" }); // Changed to singular
await fastify.register(subscriptionRoutes, { prefix: "/api/subscription" }); // Changed to singular
await fastify.register(userRoutes, { prefix: "/api/user" });
await fastify.register(contactRoutes, { prefix: "/api/contact" });
await fastify.register(testRoutes, { prefix: "/api/test" });

const start = async () => {
  try {
    const PORT = process.env.PORT || 5002;
    const HOST = "0.0.0.0";
    
    await fastify.listen({ port: PORT, host: HOST });
    fastify.log.info(`🚀 Fastify Server running on port ${PORT} at ${HOST}`);
  } catch (err) {
    fastify.log.error("Failed to start server", err);
    process.exit(1);
  }
};

start();
