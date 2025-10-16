"use client";

import { useEffect, useState } from "react";
import { DocuSignTemplateData } from "@/types/docusign";
import { TabNavigation } from "./TabNavigation";
import { DashboardTabs } from "./DashboardTabs";
import { tabs } from "./constants";
import { TabType, Recipient } from "./types";
import apiClient from "@/lib/apiClient";

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
interface DashboardClientProps {}

export default function DashboardClient({}: DashboardClientProps) {
	const [activeTab, setActiveTab] = useState<TabType>("upload");
	const [selectedTemplate, setSelectedTemplate] = useState<DocuSignTemplateData | null>(null);
	const [recipients, setRecipients] = useState<Recipient[]>([]);
	const [messageSubject, setMessageSubject] = useState("Please sign this document");
	const [messageBody, setMessageBody] = useState("Please review and sign the highlighted fields.");
	const [resultUrls, setResultUrls] = useState<string[] | null>(null);
	const [usage, setUsage] = useState<{
		hasActiveSubscription?: boolean;
		uploads?: { used: number; limit: number };
		signs?: { used: number; limit: number };
	} | null>(null);

	useEffect(() => {
		let mounted = true;
		(async () => {
			try {
				const res = await apiClient.get<{ success?: boolean; data?: { usage?: unknown } }>(
					"/dashboard/stats"
				);
				if (mounted && res && typeof res === "object") {
					const data = (res as Record<string, unknown>).data as Record<string, unknown> | undefined;
					const usageObj = data?.usage as unknown as {
						hasActiveSubscription?: boolean;
						uploads?: { used: number; limit: number };
						signs?: { used: number; limit: number };
					};
					if (usageObj) setUsage(usageObj);
				}
			} catch {
				// ignore banner if stats fail
			}
		})();
		return () => {
			mounted = false;
		};
	}, []);

	const handleTemplateSelect = (template: DocuSignTemplateData) => {
		if (!template) {
			console.error("Template selection failed: template is undefined");
			return;
		}
		if (!template._id) {
			console.error("Template selection failed: template missing _id");
			return;
		}
		// Check if template has a PDF URL (all documents are now PDFs)
		if (!template.pdfUrl && !template.metadata?.originalPdfPath) {
			console.error("Template selection failed: template missing PDF URL", template);
			return;
		}
		console.log("Selecting template:", template._id, template.metadata?.filename || template.name);
		setSelectedTemplate(template);
		if (activeTab === "templates") {
			setActiveTab("viewer");
		}
	};

	const handleUploadSuccess = (template: DocuSignTemplateData) => {
		setSelectedTemplate(template);
		setActiveTab("viewer");
	};

	return (
		<div className="space-y-6">
			{/* Free plan usage banner */}
			{usage && usage.hasActiveSubscription === false && (
				<div className="rounded-lg border border-yellow-400/40 bg-yellow-50/80 p-4 text-yellow-900">
					<div className="flex items-start justify-between gap-3">
						<div>
							<p className="font-medium">You are on the Free plan</p>
							<p className="mt-1 text-sm">
								Uploads: {usage.uploads?.used ?? 0} of {usage.uploads?.limit ?? 1} used • Signing:{" "}
								{usage.signs?.used ?? 0} of {usage.signs?.limit ?? 1} used
							</p>
						</div>
						<a
							href="/subscription"
							className="shrink-0 rounded-md bg-yellow-600 px-3 py-2 text-sm font-medium text-white hover:bg-yellow-700"
						>
							Upgrade
						</a>
					</div>
				</div>
			)}
			<TabNavigation tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />
			<DashboardTabs
				activeTab={activeTab}
				selectedTemplate={selectedTemplate}
				recipients={recipients}
				messageSubject={messageSubject}
				messageBody={messageBody}
				resultUrls={resultUrls}
				onTemplateSelect={handleTemplateSelect}
				onUploadSuccess={handleUploadSuccess}
				onTabChange={setActiveTab}
				setSelectedTemplate={setSelectedTemplate}
				setRecipients={setRecipients}
				setMessageSubject={setMessageSubject}
				setMessageBody={setMessageBody}
				setResultUrls={setResultUrls}
			/>
		</div>
	);
}
