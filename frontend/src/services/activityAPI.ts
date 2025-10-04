"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { serverApi } from "@/lib/serverApiClient";
import { Activity, ActivityResponse } from "@/types/activity";

// Define the schema for creating a new activity
const createActivitySchema = z.object({
	type: z.string().min(1, "Activity type is required."),
	message: z.string().min(1, "Activity message is required."),
	details: z.record(z.string(), z.unknown()).optional(),
});

// Server Action to fetch recent activities
export async function getRecentActivities(): Promise<{
	success: boolean;
	activities?: Activity[];
	message?: string;
}> {
	try {
		const result = await serverApi.get("/activity/recent", {
			tags: ["activities"],
			revalidate: 300,
		});
		return { success: true, activities: result.data };
	} catch (error: unknown) {
		console.error("Error fetching activities:", error);
		return {
			success: false,
			message: error instanceof Error ? error.message : "Failed to fetch activities.",
		};
	}
}

// Server Action to create a new activity (for future use)
export async function createActivity(
	_prevState: ActivityResponse,
	formData: FormData
): Promise<ActivityResponse> {
	const rawData = {
		type: formData.get("type"),
		message: formData.get("message"),
		details: formData.get("details") ? JSON.parse(formData.get("details") as string) : undefined,
	};

	const validatedFields = createActivitySchema.safeParse(rawData);

	if (!validatedFields.success) {
		console.log(validatedFields.error.flatten().fieldErrors);
		return {
			success: false,
			message: "Validation failed.",
			errors: validatedFields.error.flatten().fieldErrors,
		};
	}

	try {
		const result = await serverApi.post("/activity", validatedFields.data);
		revalidatePath("/"); // Revalidate home page after creating activity
		return {
			success: true,
			message: "Activity created successfully!",
			data: result.data,
		};
	} catch (error: unknown) {
		console.error("Error creating activity:", error);
		return {
			success: false,
			message: error instanceof Error ? error.message : "Failed to create activity.",
		};
	}
}

// Server Action to fetch DocuSign activities with filtering
export async function getDocuSignActivities(params?: {
	page?: number;
	limit?: number;
	type?: string;
	search?: string;
}): Promise<{
	success: boolean;
	data?: Activity[];
	pagination?: {
		current: number;
		pages: number;
		total: number;
		limit: number;
	};
	message?: string;
}> {
	try {
		// Build query parameters
		const queryParams = new URLSearchParams();
		if (params?.page) queryParams.append("page", params.page.toString());
		if (params?.limit) queryParams.append("limit", params.limit.toString());
		if (params?.type) queryParams.append("type", params.type);
		if (params?.search) queryParams.append("search", params.search);

		const url = `/activity/docusign${queryParams.toString() ? `?${queryParams.toString()}` : ""}`;
		const result = await serverApi.get(url);

		return {
			success: true,
			data: result.data,
			pagination: result.pagination,
		};
	} catch (error: unknown) {
		console.error("Error fetching DocuSign activities:", error);
		return {
			success: false,
			message: error instanceof Error ? error.message : "Failed to fetch DocuSign activities.",
		};
	}
}
