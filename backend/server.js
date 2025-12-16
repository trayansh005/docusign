import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import compression from "compression";
import cookieParser from "cookie-parser";
import hpp from "hpp";
import mongoSanitize from "express-mongo-sanitize";
import path from "path";
import { fileURLToPath } from "url";
import { apiRateLimit, authRateLimit, sanitizeInput } from "./middlewares/security.js";
import connectDB from "./database/connection.js";
import authRoutes from "./routes/auth.js";
import subscriptionRoutes from "./routes/subscription.js";
import activityRoutes from "./routes/activity.js";
import docusignRoutes from "./routes/docusign.js";
import signatureRoutes from "./routes/signature.js";
import userRoutes from "./routes/user.js";
import dashboardRoutes from "./routes/dashboard.js";
import uploadsStatic from "./middleware/uploadsStatic.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Security middleware - Helmet with default settings (same as RCSS)
app.use(helmet());

// Logging middleware
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));

// Compression middleware
app.use(compression());

// CORS middleware
const allowedOrigins = [
	process.env.FRONTEND_URL || "http://localhost:3000",
	"https://fomiqsign.com",
	"http://localhost:3000",
];

app.use(
	cors({
		origin: (origin, callback) => {
			// Allow requests with no origin (like mobile apps or curl requests)
			if (!origin) return callback(null, true);

			if (allowedOrigins.indexOf(origin) !== -1) {
				callback(null, true);
			} else {
				callback(new Error("Not allowed by CORS"));
			}
		},
		credentials: true,
		methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
		allowedHeaders: ["Content-Type", "Authorization", "Range"],
		exposedHeaders: ["Content-Length", "Content-Range"],
	})
);

// Body parsing middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Security hardening
app.use(hpp());
app.use(
	mongoSanitize({
		replaceWith: "_",
	})
);

// Cookie parser middleware
app.use(cookieParser());

// Debug middleware to test if /api/ middlewares are being called
app.use("/api/", (req, res, next) => {
	console.log("🔥 DEBUG: /api/ middleware called for:", req.method, req.originalUrl);
	next();
});

// Rate limiting
app.use("/api/", apiRateLimit);

// Input sanitization
app.use(sanitizeInput);

// Static files (frontend)
app.use(express.static("../frontend"));

// Static files (uploads) - middleware to set CORS headers and disable caching for signed PDFs
app.use("/api/uploads", (req, res, next) => {
	res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");

	// Disable caching for signed PDFs (they get updated when recipients sign)
	if (req.path.includes("/signatures/signed/")) {
		res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
		res.setHeader("Pragma", "no-cache");
		res.setHeader("Expires", "0");
	}

	next();
});
app.use("/api/uploads", express.static(path.join(process.cwd(), "uploads")));

// Mount API routes
app.use("/api/auth", authRateLimit, authRoutes);
app.use("/api/subscription", subscriptionRoutes);
app.use("/api/activity", activityRoutes);
app.use("/api/docusign", docusignRoutes);
app.use("/api/signatures", signatureRoutes);
app.use("/api/users", userRoutes);
app.use("/api/dashboard", dashboardRoutes);

// Test routes (only in development)
if (process.env.NODE_ENV !== "production") {
	const testRoutes = await import("./routes/test.js");
	app.use("/api/test", testRoutes.default);
}

connectDB();

// Health check route
app.get("/api/health", (req, res) => {
	res.status(200).json({
		status: "OK",
		timestamp: new Date().toISOString(),
		uptime: process.uptime(),
		environment: process.env.NODE_ENV || "development",
	});
});

// Graceful shutdown
process.on("SIGTERM", () => {
	console.log("SIGTERM received. Shutting down gracefully...");
	process.exit(0);
});

process.on("SIGINT", () => {
	console.log("SIGINT received. Shutting down gracefully...");
	process.exit(0);
});

app.listen(PORT, () => {
	console.log(`🚀 Server running on port ${PORT}`);
	console.log(`📊 Health check available at http://localhost:${PORT}/api/health`);
	console.log(`🌍 Environment: ${process.env.NODE_ENV || "development"}`);
});
