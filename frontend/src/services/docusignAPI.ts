"use server";

import { serverApi } from "@/lib/serverApiClient";
import {
	DocuSignTemplateData,
	SignatureField,
	PaginationData,
	SignatureData,
	SignedPageData,
	ViewportData,
	RecipientData,
	StatusHistoryData,
	SignatureTrackingData,
	ActivityData,
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
export const uploadPDF = async (file: File, name?: string): Promise<DocuSignTemplateData> => {
	const formData = new FormData();
	formData.append("pdf", file);
	if (name) formData.append("name", name);

	const result = await serverApi.post("/docusign/upload", formData, {
		headers: { "Content-Type": "multipart/form-data" },
	});

	if (!result.success) {
		throw new Error(result.message || "Failed to upload PDF");
	}

	return result.data;
};

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

// Page Operations
export const getTemplatePage = async (
	templateId: string,
	pageNumber: number
): Promise<{
	templateId: string;
	pageNumber: number;
	imageUrl: string;
	imageHash: string;
	fileSize: number;
	width: number;
	height: number;
}> => {
	const result = await serverApi.get(`/docusign/${templateId}/page/${pageNumber}`);

	if (!result.success) {
		throw new Error(result.message || "Failed to get template page");
	}

	return result.data;
};

export const updateTemplatePageFields = async (
	templateId: string,
	pageNumber: number,
	signatureFields: SignatureField[],
	viewport?: ViewportData
): Promise<DocuSignTemplateData> => {
	const result = await serverApi.put(`/docusign/${templateId}/page/${pageNumber}/fields`, {
		signatureFields,
		viewport,
	});

	if (!result.success) {
		throw new Error(result.message || "Failed to update template page fields");
	}

	return result.data;
};

// Signature Operations
export const applySignatures = async (
	templateId: string,
	signatures: SignatureData[],
	fields?: SignatureField[],
	viewport?: ViewportData
): Promise<{ templateId: string; signedPages: SignedPageData[] }> => {
	const result = await serverApi.post(`/docusign/${templateId}/apply-signatures`, {
		signatures,
		fields,
		viewport,
	});

	if (!result.success) {
		throw new Error(result.message || "Failed to apply signatures");
	}

	return result.data;
};

export const getSignedDocument = async (
	templateId: string
): Promise<{
	template: DocuSignTemplateData;
	signedPages: SignedPageData[];
}> => {
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

// Activity logging is handled by the activity API service
// Import getDocuSignActivities from activityAPI.ts instead
