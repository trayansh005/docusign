export type TabType = "upload" | "templates" | "status" | "activity" | "tracking";

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
	signingOrder: number;
	color?: string; // Color for visual identification
}
