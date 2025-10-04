import app from "./app.js";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

const PORT = process.env.PORT || 5000;
const NODE_ENV = process.env.NODE_ENV || "development";

// Start server
app.listen(PORT, () => {
	console.log(`
🚀 Server is running on port ${PORT}
📱 Environment: ${NODE_ENV}
🌐 URL: http://localhost:${PORT}
🏥 Health: http://localhost:${PORT}/health
	`);
});

// Graceful shutdown
process.on("SIGINT", () => {
	console.log("\n👋 Shutting down server gracefully...");
	process.exit(0);
});

process.on("SIGTERM", () => {
	console.log("\n👋 Shutting down server gracefully...");
	process.exit(0);
});
