import express from "express";
import path from "path";
import authRoutes from "./auth.js";
import docusignRoutes from "./docusign.js";
import subscriptionRoutes from "./subscription.js";

export const configureRoutes = (app, __dirname) => {
	// API Routes
	app.use("/api/auth", authRoutes);
	app.use("/api/docusign", docusignRoutes);
	app.use("/api/subscriptions", subscriptionRoutes);

	// Static file serving for uploads
	app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

	// Health check
	app.get("/health", (req, res) => {
		res.status(200).json({
			success: true,
			message: "Server is running",
			timestamp: new Date().toISOString(),
			environment: process.env.NODE_ENV || "development",
		});
	});

	// API documentation route
	app.get("/api", (req, res) => {
		res.status(200).json({
			success: true,
			message: "DocuSign Integration API",
			version: "1.0.0",
			endpoints: {
				auth: {
					register: "POST /api/auth/register",
					login: "POST /api/auth/login",
					profile: "GET /api/auth/profile",
					updateProfile: "PUT /api/auth/profile",
					changePassword: "PUT /api/auth/change-password",
				},
				docusign: {
					upload: "POST /api/docusign/upload",
					listTemplates: "GET /api/docusign/",
					getTemplatePage: "GET /api/docusign/:templateId/page/:pageNumber",
					getTemplatePageImage: "GET /api/docusign/:templateId/pages/:pageNumber/image",
					updateTemplatePageFields: "PUT /api/docusign/:templateId/page/:pageNumber/fields",
					deleteTemplate: "DELETE /api/docusign/:templateId",
					applySignatures: "POST /api/docusign/:templateId/apply-signatures",
					getSignedDocument: "GET /api/docusign/:templateId/signed",
					updateTemplateStatus: "PUT /api/docusign/:templateId/status",
					getTemplateStatusHistory: "GET /api/docusign/:templateId/status-history",
					getTemplatesByStatus: "GET /api/docusign/status/filter",
					getSignatureTracking: "GET /api/docusign/:templateId/signature-tracking",
				},
				subscriptions: {
					// Add subscription endpoints here
				},
			},
		});
	});
};
