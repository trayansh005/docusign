export interface Activity {
	_id: string;
	user: string | import("./auth").User;
	type: string;
	message: string;
	details?: Record<string, unknown>;
	createdAt: string;
	updatedAt: string;
}

export interface ActivityResponse {
	success: boolean;
	message?: string;
	data?: Record<string, unknown>;
	errors?: Record<string, string[] | undefined>;
}

export interface CreateActivityData {
	type: string;
	message: string;
	details?: Record<string, unknown>;
}
