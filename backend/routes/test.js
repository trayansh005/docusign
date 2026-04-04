import { processWordDocument } from "../utils/wordProcessor.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Test routes Fastify plugin
 */
export default async function testRoutes(fastify, options) {
  // Test endpoint to check if a specific image file exists
  fastify.get("/image-exists/:templateId/:pageNumber", async (request, reply) => {
    try {
      const { templateId, pageNumber } = request.params;
      const imagePath = path.join(process.cwd(), "uploads", "signatures", "templates", templateId, `page_${pageNumber}.png`);

      const exists = fs.existsSync(imagePath);
      let stats = null;

      if (exists) {
        stats = fs.statSync(imagePath);
      }

      return {
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
        expectedUrl: `/uploads/signatures/templates/${templateId}/page_${pageNumber}.png`
      };

    } catch (error) {
      return reply.status(500).send({
        success: false,
        error: error.message
      });
    }
  });

  // Test endpoint to verify Word document processing
  fastify.get("/word-processor", async (request, reply) => {
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

      return {
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
      };

    } catch (error) {
      return reply.status(500).send({
        success: false,
        message: "Word processor test failed",
        error: error.message
      });
    }
  });

  // Test endpoint to debug static file serving
  fastify.get("/debug-static/:templateId/:pageNumber", async (request, reply) => {
    try {
      const { templateId, pageNumber } = request.params;

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

      return {
        success: true,
        templateId,
        pageNumber,
        cwd: process.cwd(),
        __dirname,
        paths: results,
        expectedStaticUrl: `/uploads/signatures/templates/${templateId}/page_${pageNumber}.png`
      };

    } catch (error) {
      return reply.status(500).send({
        success: false,
        error: error.message
      });
    }
  });
}