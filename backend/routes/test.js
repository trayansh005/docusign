import express from "express";
import { processWordDocument } from "../utils/wordProcessor.js";
import fs from "fs";
import path from "path";

const router = express.Router();

// Test endpoint to check if a specific image file exists
router.get("/image-exists/:templateId/:pageNumber", (req, res) => {
    try {
        const { templateId, pageNumber } = req.params;
        const imagePath = path.join(process.cwd(), "uploads", "signatures", "templates", templateId, `page_${pageNumber}.png`);

        const exists = fs.existsSync(imagePath);
        let stats = null;

        if (exists) {
            stats = fs.statSync(imagePath);
        }

        res.json({
            success: true,
            templateId,
            pageNumber,
            imagePath,
            exists,
            stats: stats ? {
                size: stats.size,
                created: stats.birthtime,
                modified: stats.mtime
            } : null,
            expectedUrl: `/api/uploads/signatures/templates/${templateId}/page_${pageNumber}.png`
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Test endpoint to verify Word document processing
router.get("/word-processor", async (req, res) => {
    try {
        const testDir = path.join(process.cwd(), "test-word-output");
        const testTemplateId = "test-template-123";

        // Create test directory
        if (!fs.existsSync(testDir)) {
            fs.mkdirSync(testDir, { recursive: true });
        }

        // Test the Word processor with a fake file path
        const pages = await processWordDocument(
            "test-document.docx", // Fake path for testing
            testDir,
            testTemplateId
        );

        // Check if image was created
        const imagePath = path.join(testDir, "page_1.png");
        const imageExists = fs.existsSync(imagePath);

        let imageStats = null;
        if (imageExists) {
            imageStats = fs.statSync(imagePath);
        }

        // Cleanup
        if (fs.existsSync(testDir)) {
            fs.rmSync(testDir, { recursive: true, force: true });
        }

        res.json({
            success: true,
            message: "Word processor test completed",
            data: {
                pages,
                imageExists,
                imageStats: imageStats ? {
                    size: imageStats.size,
                    created: imageStats.birthtime
                } : null
            }
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Word processor test failed",
            error: error.message
        });
    }
});

// Test endpoint to debug static file serving
router.get("/debug-static/:templateId/:pageNumber", (req, res) => {
    try {
        const { templateId, pageNumber } = req.params;

        // Different possible paths
        const paths = {
            absolute: path.join(process.cwd(), "uploads", "signatures", "templates", templateId, `page_${pageNumber}.png`),
            relative: path.join("uploads", "signatures", "templates", templateId, `page_${pageNumber}.png`),
            serverRelative: path.join(__dirname, "..", "uploads", "signatures", "templates", templateId, `page_${pageNumber}.png`)
        };

        const results = {};

        for (const [key, filePath] of Object.entries(paths)) {
            results[key] = {
                path: filePath,
                exists: fs.existsSync(filePath),
                resolved: path.resolve(filePath)
            };
        }

        res.json({
            success: true,
            templateId,
            pageNumber,
            cwd: process.cwd(),
            __dirname,
            paths: results,
            expectedStaticUrl: `/api/uploads/signatures/templates/${templateId}/page_${pageNumber}.png`
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

export default router;