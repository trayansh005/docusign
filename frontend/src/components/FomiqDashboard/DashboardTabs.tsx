"use client";

import ActivityClient from "@/app/fomiqsign/activity/ActivityClient";
import StatusTrackerClient from "@/app/fomiqsign/status-tracker/StatusTrackerClient";
import { PDFUpload } from "@/components/docusign/PDFUpload";
import { SignatureTracking } from "@/components/docusign/SignatureTracking";
import { TemplateList } from "@/components/docusign/TemplateList";
import { DocuSignTemplateData } from "@/types/docusign";
import { Activity } from "lucide-react";
import { TabType } from "./types";

interface DashboardTabsProps {
	activeTab: TabType;
	selectedTemplate: DocuSignTemplateData | null;
	onTemplateSelect: (template: DocuSignTemplateData) => void;
	onUploadSuccess: (template: DocuSignTemplateData) => void;
	onTabChange: (tab: TabType) => void;
}

export function DashboardTabs({
	activeTab,
	selectedTemplate,
	onTemplateSelect,
	onUploadSuccess,
	onTabChange,
}: DashboardTabsProps) {
	const renderTabContent = () => {
		switch (activeTab) {
			case "upload":
				return (
					<div className="space-y-6 p-6">
						<div>
							<h2 className="text-2xl font-semibold text-gray-100 mb-2">Upload Document</h2>
							<p className="text-gray-300">
								Upload a PDF or Word document to create a new FomiqSign template. The system will
								automatically convert it to images and prepare it for signature placement.
							</p>
						</div>
						<PDFUpload onUploadSuccess={onUploadSuccess} />
					</div>
				);

			case "templates":
				return (
					<div className="p-6">
						<h2 className="text-2xl font-semibold text-white mb-4">Templates</h2>
						<TemplateList onViewTemplate={onTemplateSelect} />
					</div>
				);

			case "status":
				return (
					<div className="space-y-6 p-6">
						<div>
							<h2 className="text-2xl font-semibold text-white mb-2">Document Status Tracker</h2>
							<p className="text-gray-400">
								Track the status of your documents and view their processing history.
							</p>
						</div>
						<StatusTrackerClient />
					</div>
				);

			case "activity":
				return (
					<div className="space-y-6 p-6">
						<div>
							<h2 className="text-2xl font-semibold text-white mb-2">Activity Logs</h2>
							<p className="text-gray-400">
								View all FomiqSign-related activities and system events.
							</p>
						</div>
						<ActivityClient />
					</div>
				);

			case "tracking":
				return (
					<div className="space-y-6 p-6">
						<div>
							<h2 className="text-2xl font-semibold text-white mb-2">Signature Tracking</h2>
							<p className="text-gray-400">
								Track signature events, IP addresses, and geographic locations.
							</p>
						</div>
						{selectedTemplate ? (
							<SignatureTracking templateId={selectedTemplate._id} />
						) : (
							<div className="text-center py-12">
								<Activity className="mx-auto h-12 w-12 text-gray-400 mb-4" />
								<h3 className="text-lg font-medium text-white mb-2">No Template Selected</h3>
								<p className="text-gray-400 mb-4">
									Select a template to view signature tracking information.
								</p>
								<button onClick={() => onTabChange("templates")} className="btn btn-primary">
									Select Template
								</button>
							</div>
						)}
					</div>
				);

			default:
				return null;
		}
	};

	return (
		<div className="bg-gray-800/50 rounded-lg overflow-hidden" style={{ minHeight: "80vh" }}>
			{renderTabContent()}
		</div>
	);
}
