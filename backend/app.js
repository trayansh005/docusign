import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { configureMiddleware } from "./middlewares/config.js";
import { configureRoutes } from "./routes/config.js";
import { connectDatabase } from "./database/connection.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Connect to database
connectDatabase();

// Configure middleware
configureMiddleware(app);

// Configure routes
configureRoutes(app, __dirname);

// Global error handling middleware
app.use((err, req, res, next) => {
	console.error("Error occurred:", {
		message: err.message,
		stack: err.stack,
		url: req.url,
		method: req.method,
		timestamp: new Date().toISOString(),
	});

	res.status(err.statusCode || 500).json({
		success: false,
		message: err.message || "Internal Server Error",
		// Preserve error code if it exists (for things like FREE_LIMIT_REACHED)
		...(err.code && { code: err.code }),
		...(process.env.NODE_ENV === "development" && { stack: err.stack }),
	});
});

// Handle 404 routes
app.use((req, res) => {
	res.status(404).json({
		success: false,
		message: "Route not found",
		path: req.url,
	});
});

// Health check endpoint
app.get("/health", (req, res) => {
	res.status(200).json({
		success: true,
		message: "Server is running",
		timestamp: new Date().toISOString(),
	});
});

export default app;
