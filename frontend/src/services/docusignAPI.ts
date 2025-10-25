"use server";

import { serverApi } from "@/lib/serverApiClient";
import {
	DocuSignTemplateData,
	SignatureField,
	PaginationData,
	SignatureData,
	RecipientData,
	StatusHistoryData,
	SignatureTrackingData,
} from "@/types/docusign";

// Helper function to build URL with query parameters
function buildUrl(endpoint: string, params?: Record<string, unknown>): string {
	if (!params) return endpoint;

	const searchParams = new URLSearchParams();
	Object.entries(params).forEach(([key, value]) => {
		if (value !== undefined && value !== null) {
			searchParams.append(key, String(value));
		}
	});

	const queryString = searchParams.toString();
	return queryString ? `${endpoint}?${queryString}` : endpoint;
}

// Template Management
export const uploadDocument = async (file: File, name?: string): Promise<DocuSignTemplateData> => {
	const formData = new FormData();
	formData.append("document", file);
	if (name) formData.append("name", name);

	try {
		const result = await serverApi.post("/docusign/upload", formData, {
			headers: { "Content-Type": "multipart/form-data" },
		});

		if (!result.success) {
			// Create error message with embedded code that survives serialization
			// Format: "ERROR:CODE:message" so we can parse it on the client
			const errorMsg = `ERROR:${result.code || "UNKNOWN"}:${result.message || "Upload failed"}`;
			console.log("[uploadDocument] Throwing error:", errorMsg);
			throw new Error(errorMsg);
		}

		return result.data;
	} catch (error) {
		// If it's already our formatted error, re-throw as-is
		if (error instanceof Error && error.message.startsWith("ERROR:")) {
			throw error;
		}
		// If it's an ApiError from serverApi, wrap it with our format
		if (error instanceof Error) {
			const code = (error as unknown as Record<string, string>).code || "UNKNOWN";
			const errorMsg = `ERROR:${code}:${error.message}`;
			console.log("[uploadDocument] Wrapping error:", errorMsg);
			throw new Error(errorMsg);
		}
		throw error;
	}
};

// Keep the old function name for backward compatibility
export const uploadPDF = uploadDocument;

export const getTemplates = async (params?: {
	page?: number;
	limit?: number;
	status?: string;
	type?: string;
	search?: string;
}): Promise<{ data: DocuSignTemplateData[]; pagination: PaginationData }> => {
	const url = buildUrl("/docusign", params);
	const result = await serverApi.get(url);

	if (!result.success) {
		throw new Error(result.message || "Failed to fetch templates");
	}

	return result;
};

export const deleteTemplate = async (templateId: string): Promise<void> => {
	const result = await serverApi.delete(`/docusign/${templateId}`);

	if (!result.success) {
		throw new Error(result.message || "Failed to delete template");
	}
};

// Field Operations
export const addSignatureField = async (
	templateId: string,
	field: Omit<SignatureField, "id">
): Promise<DocuSignTemplateData> => {
	const result = await serverApi.post(`/docusign/${templateId}/fields`, { field });

	if (!result.success) {
		throw new Error(result.message || "Failed to add signature field");
	}

	return result.data;
};

export const updateSignatureField = async (
	templateId: string,
	fieldId: string,
	updates: Partial<SignatureField>
): Promise<DocuSignTemplateData> => {
	const result = await serverApi.put(`/docusign/${templateId}/fields/${fieldId}`, updates);

	if (!result.success) {
		throw new Error(result.message || "Failed to update signature field");
	}

	return result.data;
};

export const deleteSignatureField = async (
	templateId: string,
	fieldId: string
): Promise<DocuSignTemplateData> => {
	const result = await serverApi.delete(`/docusign/${templateId}/fields/${fieldId}`);

	if (!result.success) {
		throw new Error(result.message || "Failed to delete signature field");
	}

	return result.data;
};

// Signature Operations
export const applySignatures = async (
	templateId: string,
	signatures: SignatureData[]
): Promise<{ templateId: string; finalPdfUrl: string }> => {
	const result = await serverApi.post(`/docusign/${templateId}/apply-signatures`, {
		signatures,
	});

	if (!result.success) {
		throw new Error(result.message || "Failed to apply signatures");
	}

	return result.data;
};

export const getSignedDocument = async (
	templateId: string
): Promise<{ template: DocuSignTemplateData; finalPdfUrl: string }> => {
	const result = await serverApi.get(`/docusign/${templateId}/signed`);

	if (!result.success) {
		throw new Error(result.message || "Failed to get signed document");
	}

	return result.data;
};

// Status and Tracking
export const updateTemplateStatus = async (
	templateId: string,
	status: string,
	docusignStatus?: string,
	recipients?: RecipientData[]
): Promise<DocuSignTemplateData> => {
	const result = await serverApi.put(`/docusign/${templateId}/status`, {
		status,
		docusignStatus,
		recipients,
	});

	if (!result.success) {
		throw new Error(result.message || "Failed to update template status");
	}

	return result.data;
};

export const getTemplateStatusHistory = async (templateId: string): Promise<StatusHistoryData> => {
	const result = await serverApi.get(`/docusign/${templateId}/status-history`);

	if (!result.success) {
		throw new Error(result.message || "Failed to get template status history");
	}

	return result.data;
};

export const getTemplatesByStatus = async (params?: {
	status?: string;
	docusignStatus?: string;
	page?: number;
	limit?: number;
}): Promise<{ data: DocuSignTemplateData[]; pagination: PaginationData }> => {
	const url = buildUrl("/docusign/status/filter", params);
	const result = await serverApi.get(url);

	if (!result.success) {
		throw new Error(result.message || "Failed to get templates by status");
	}

	return result;
};

export const getSignatureTracking = async (templateId: string): Promise<SignatureTrackingData> => {
	const result = await serverApi.get(`/docusign/${templateId}/signature-tracking`);

	if (!result.success) {
		throw new Error(result.message || "Failed to get signature tracking data");
	}

	return result.data;
};

// Recipients and Signing Order Management
export const addRecipients = async (
	templateId: string,
	recipients: Array<{ name: string; email: string; signingOrder?: number }>
): Promise<{ template: DocuSignTemplateData; addedRecipients: RecipientData[] }> => {
	const result = await serverApi.post(`/docusign/${templateId}/recipients`, {
		recipients,
	});

	if (!result.success) {
		throw new Error(result.message || "Failed to add recipients");
	}

	return result.data;
};

export const updateSigningOrder = async (
	templateId: string,
	recipients: Array<{ id: string; signingOrder: number }>
): Promise<DocuSignTemplateData> => {
	const result = await serverApi.put(`/docusign/${templateId}/recipients/order`, {
		recipients,
	});

	if (!result.success) {
		throw new Error(result.message || "Failed to update signing order");
	}

	return result.data;
};

export const removeRecipient = async (
	templateId: string,
	recipientId: string
): Promise<{ template: DocuSignTemplateData; removedRecipient: RecipientData }> => {
	const result = await serverApi.delete(`/docusign/${templateId}/recipients/${recipientId}`);

	if (!result.success) {
		throw new Error(result.message || "Failed to remove recipient");
	}

	return result.data;
};

export const getSigningProgress = async (templateId: string): Promise<{
	totalRecipients: number;
	signedRecipients: number;
	completionPercentage: number;
	nextRecipient: {
		id: string;
		name: string;
		email: string;
		signingOrder: number;
	} | null;
	recipients: RecipientData[];
	isComplete: boolean;
}> => {
	const result = await serverApi.get(`/docusign/${templateId}/signing-progress`);

	if (!result.success) {
		throw new Error(result.message || "Failed to get signing progress");
	}

	return result.data;
};

export const checkSigningEligibility = async (
	templateId: string,
	recipientEmail: string
): Promise<{
	canSign: boolean;
	recipient: {
		id: string;
		name: string;
		email: string;
		signatureStatus: string;
		signingOrder: number;
		signedAt?: string;
	} | null;
	nextRecipient: {
		id: string;
		name: string;
		email: string;
		signingOrder: number;
	} | null;
	message: string;
}> => {
	const result = await serverApi.get(`/docusign/${templateId}/signing-eligibility`, {
		params: { recipientEmail },
	});

	if (!result.success) {
		throw new Error(result.message || "Failed to check signing eligibility");
	}

	return result.data;
};

// Activity logging is handled by the activity API service
// Import getDocuSignActivities from activityAPI.ts instead
