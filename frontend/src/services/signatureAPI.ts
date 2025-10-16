"use server";

import { serverApi } from "@/lib/serverApiClient";

export const uploadSignatureFile = async (file: File, label?: string) => {
	const form = new FormData();
	form.append("file", file);
	if (label) form.append("label", label);

	const result = await serverApi.post("/signatures/upload", form, {
		headers: { "Content-Type": "multipart/form-data" },
	});

	if (!result.success) throw new Error(result.message || "Failed to upload signature");
	return result.data;
};

export const createSignatureFromDataUrl = async (
	dataUrl: string,
	label?: string,
	fontId?: string
) => {
	const result = await serverApi.post(`/signatures/from-dataurl`, { dataUrl, label, fontId });
	if (!result.success) throw new Error(result.message || "Failed to create signature from dataUrl");
	return result.data;
};

export const listSignatures = async () => {
	const result = await serverApi.get(`/signatures`);
	if (!result.success) throw new Error(result.message || "Failed to list signatures");
	return result.data;
};

export const deleteSignature = async (id: string) => {
	const result = await serverApi.delete(`/signatures/${id}`);
	if (!result.success) throw new Error(result.message || "Failed to delete signature");
	return true;
};

export const setDefaultSignature = async (id: string) => {
	const result = await serverApi.post(`/signatures/${id}/default`);
	if (!result.success) throw new Error(result.message || "Failed to set default signature");
	return result.data;
};
