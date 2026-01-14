import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import compression from "compression";
import cookieParser from "cookie-parser";
import hpp from "hpp";
import mongoSanitize from "express-mongo-sanitize";

export function configureMiddleware(app) {
	// Security middleware
	const allowedOrigins = [
		process.env.FRONTEND_URL,
		"http://localhost:3000",
		"http://127.0.0.1:3000",
	].filter(Boolean);

	const corsOptions = {
		origin: (origin, callback) => {
			// Allow requests with no origin (like mobile apps or curl)
			if (!origin) return callback(null, true);

			if (allowedOrigins.includes(origin) || process.env.NODE_ENV === "development") {
				callback(null, true);
			} else {
				callback(new Error("Not allowed by CORS"));
			}
		},
		credentials: true,
		methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
		allowedHeaders: [
			"Content-Type",
			"Authorization",
			"Cookie",
			"X-Requested-With",
			"Accept",
			"X-API-Version",
		],
		exposedHeaders: ["Set-Cookie"],
		maxAge: 86400, // Cache preflight requests for 24 hours
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

	// Security hardening
	app.use(hpp());
	app.use(
		mongoSanitize({
			replaceWith: "_",
		})
	);

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
