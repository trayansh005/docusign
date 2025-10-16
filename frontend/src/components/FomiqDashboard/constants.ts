import { Upload, FileText, Eye, BarChart3, History, Settings, Activity } from "lucide-react";
import { Tab } from "./types";

export const tabs: Tab[] = [
	{
		id: "upload",
		label: "Upload Document",
		icon: Upload,
		description: "Upload and process PDF and Word documents",
	},
	{
		id: "templates",
		label: "Templates",
		icon: FileText,
		description: "Manage your document templates",
	},
	{
		id: "viewer",
		label: "Viewer",
		icon: Eye,
		description: "View and edit document templates",
	},
	{
		id: "status",
		label: "Status Tracker",
		icon: BarChart3,
		description: "Track document status and history",
	},
	{
		id: "activity",
		label: "Activity Logs",
		icon: History,
		description: "View all FomiqSign activities",
	},
	{
		id: "tracking",
		label: "Signature Tracking",
		icon: Activity,
		description: "Track signature events and locations",
	},
];
