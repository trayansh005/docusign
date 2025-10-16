export type TabType = "upload" | "templates" | "viewer" | "status" | "activity" | "tracking";

export interface Tab {
	id: TabType;
	label: string;
	icon: React.ComponentType<{ className?: string }>;
	description: string;
}

export interface Recipient {
	id: string;
	name: string;
	email?: string;
}
