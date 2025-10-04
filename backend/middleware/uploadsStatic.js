import path from "path";
import fs from "fs";

/**
 * Middleware factory to serve uploads under /api/uploads with proper CORS/CORP headers.
 * Use: app.use('/api/uploads', uploadsStatic({ uploadsDir }))
 */
export default function uploadsStatic(options = {}) {
	const uploadsDir = options.uploadsDir || path.resolve(process.cwd(), "backend", "uploads");

	return (req, res, next) => {
		try {
			// Set Cross-Origin-Resource-Policy to allow usage from other origins
			res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
			res.setHeader(
				"Access-Control-Allow-Origin",
				process.env.FRONTEND_URL || "http://localhost:3000"
			);
			res.setHeader("Access-Control-Allow-Methods", "GET");
			res.setHeader("Access-Control-Allow-Headers", "Content-Type");

			// If the request is for a legacy path with dots/underscores, normalize filename
			const reqPath = req.path || "";
			if (reqPath.startsWith("/signatures/templates/")) {
				const parts = reqPath.split("/").filter(Boolean);
				if (parts.length >= 4) {
					const templateId = parts[2];
					const filename = parts.slice(3).join("/");
					const templateDir = path.join(uploadsDir, "signatures", "templates", templateId);
					const candidates = [
						filename,
						filename.replace(/page[._-]?(\d+)\.png$/i, "page$1.png"),
						filename.replace(/page[._-]?(\d+)\.png$/i, "page_$1.png"),
						filename.replace(/page[._-]?(\d+)\.png$/i, "page-$1.png"),
					];

					for (const cand of candidates) {
						const candidatePath = path.join(templateDir, cand);
						if (fs.existsSync(candidatePath)) {
							return res.sendFile(candidatePath);
						}
					}
				}
			}

			// Fallback to express static by delegating to next (server.js will have express.static)
			return next();
		} catch (err) {
			console.error("uploadsStatic middleware error", err);
			return next();
		}
	};
}
