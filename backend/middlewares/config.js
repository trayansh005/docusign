import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import compression from "compression";
import cookieParser from "cookie-parser";

export function configureMiddleware(app) {
	// Security middleware
	const corsOptions = {
		origin: process.env.FRONTEND_URL || "http://localhost:3000",
		credentials: true,
		methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
		allowedHeaders: ["Content-Type", "Authorization", "Cookie", "Set-Cookie"],
	};

	app.use(cors(corsOptions));
	app.use(
		helmet({
			crossOriginEmbedderPolicy: false, // Allow embedding for development
			contentSecurityPolicy: {
				useDefaults: true,
				directives: {
					"script-src": ["'self'", "'unsafe-inline'"],
					"style-src": ["'self'", "'unsafe-inline'"],
				},
			},
		})
	);

	// Request logging
	if (process.env.NODE_ENV === "development") {
		app.use(morgan("dev"));
	} else {
		app.use(morgan("combined"));
	}

	// Body parsing middleware
	app.use(
		express.json({
			limit: "10mb",
			verify: (req, res, buf) => {
				req.rawBody = buf;
			},
		})
	);
	app.use(express.urlencoded({ extended: true, limit: "10mb" }));

	// Parse cookies
	app.use(cookieParser());

	// Response compression
	app.use(compression());

	// Custom middleware for request timing
	app.use((req, res, next) => {
		req.startTime = Date.now();
		next();
	});

	// Response headers middleware
	app.use((req, res, next) => {
		res.setHeader("X-API-Version", "1.0.0");
		res.setHeader("X-Response-Time", `${Date.now() - req.startTime}ms`);
		next();
	});
}
