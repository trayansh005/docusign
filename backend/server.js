import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import compression from "compression";
import cookieParser from "cookie-parser";
import path from "path";
import { fileURLToPath } from "url";
import { apiRateLimit, authRateLimit, sanitizeInput } from "./middlewares/security.js";
import connectDB from "./database/connection.js";
import authRoutes from "./routes/auth.js";
import subscriptionRoutes from "./routes/subscription.js";
import activityRoutes from "./routes/activity.js";
import docusignRoutes from "./routes/docusign.js";
import uploadsStatic from "./middleware/uploadsStatic.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Security middleware - Helmet should be first
app.use(
	helmet({
		contentSecurityPolicy: {
			directives: {
				defaultSrc: ["'self'"],
				styleSrc: ["'self'", "'unsafe-inline'", "fonts.googleapis.com"],
				fontSrc: ["'self'", "fonts.gstatic.com"],
				scriptSrc: ["'self'"],
				imgSrc: ["'self'", "data:", "https:", "http://localhost:4001"],
				connectSrc: ["'self'"],
			},
		},
		crossOriginEmbedderPolicy: false, // Disable for development
	})
);

// Logging middleware
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));

// Compression middleware
app.use(compression());

// CORS middleware
app.use(
	cors({
		origin: process.env.FRONTEND_URL || "http://localhost:3000",
		credentials: true,
		methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
		allowedHeaders: ["Content-Type", "Authorization"],
	})
);

// Body parsing middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Cookie parser middleware
app.use(cookieParser());

// Rate limiting
app.use("/api/", apiRateLimit);

// Input sanitization
app.use(sanitizeInput);

// Static files (frontend)
app.use(express.static("../frontend"));

// Static files (uploads - for template images)
app.use("/uploads", (req, res, next) => {
	// Set CORS headers for static files
	res.setHeader("Access-Control-Allow-Origin", process.env.FRONTEND_URL || "http://localhost:3000");
	res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
	res.setHeader("Access-Control-Allow-Headers", "Content-Type");
	res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
	next();
});
app.use("/uploads", express.static("uploads"));

// Mount API routes
app.use("/api/auth", authRateLimit, authRoutes);
app.use("/api/subscription", subscriptionRoutes);
app.use("/api/activity", activityRoutes);
app.use("/api/docusign", docusignRoutes);

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
