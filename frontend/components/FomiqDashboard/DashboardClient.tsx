"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { DocuSignTemplateData } from "@/types/docusign";
import { TabNavigation } from "./TabNavigation";
import { DashboardTabs } from "./DashboardTabs";
import { tabs } from "./constants";
import { TabType } from "./types";
import apiClient from "@/lib/apiClient";

// Auth protection is handled by proxy.ts — no client-side guard needed here.

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
interface DashboardClientProps {}

export default function DashboardClient({}: DashboardClientProps) {
	const router = useRouter();
	const [activeTab, setActiveTab] = useState<TabType>("upload");
	const [selectedTemplate] = useState<DocuSignTemplateData | null>(null);
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
		return () => { mounted = false; };
	}, []);

	const handleTemplateSelect = (template: DocuSignTemplateData) => {
		if (!template?._id) return;
		if (!template.pdfUrl && !template.metadata?.originalPdfPath) return;
		router.push(`/fomiqsign/dashboard/viewer?templateId=${template._id}`);
	};

	const handleUploadSuccess = (template: DocuSignTemplateData) => {
		router.push(`/fomiqsign/dashboard/viewer?templateId=${template._id}`);
	};

	return (
		<div className="space-y-6">
			{usage && usage.hasActiveSubscription === false && (
				<div
					className={`rounded-lg border p-4 ${
						(usage.uploads && usage.uploads.used >= usage.uploads.limit) ||
						(usage.signs && usage.signs.used >= usage.signs.limit)
							? "border-red-400/40 bg-red-50/80 text-red-900"
							: "border-yellow-400/40 bg-yellow-50/80 text-yellow-900"
					}`}
				>
					<div className="flex items-start justify-between gap-3">
						<div className="flex-1">
							<p className="font-medium">You are on the Free plan</p>
							<div className="mt-2 text-sm space-y-1">
								<div className="flex items-center gap-2">
									<span className={usage.uploads && usage.uploads.used >= usage.uploads.limit ? "font-semibold" : ""}>
										📄 Uploads: {usage.uploads?.used ?? 0} of {usage.uploads?.limit ?? 1} used
									</span>
									{usage.uploads && usage.uploads.used >= usage.uploads.limit && (
										<span className="text-xs bg-red-600 text-white px-2 py-0.5 rounded-full">Limit reached</span>
									)}
								</div>
								<div className="flex items-center gap-2">
									<span className={usage.signs && usage.signs.used >= usage.signs.limit ? "font-semibold" : ""}>
										✍️ Signing: {usage.signs?.used ?? 0} of {usage.signs?.limit ?? 2} used this month
									</span>
									{usage.signs && usage.signs.used >= usage.signs.limit && (
										<span className="text-xs bg-red-600 text-white px-2 py-0.5 rounded-full">Limit reached</span>
									)}
								</div>
							</div>
							{((usage.uploads && usage.uploads.used >= usage.uploads.limit) ||
								(usage.signs && usage.signs.used >= usage.signs.limit)) && (
								<p className="text-sm mt-2 font-medium">⚠️ Upgrade to continue using all features.</p>
							)}
						</div>
						<a href="/subscription" className="shrink-0 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors">
							Upgrade
						</a>
					</div>
				</div>
			)}
			<TabNavigation tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />
			<DashboardTabs
				activeTab={activeTab}
				selectedTemplate={selectedTemplate}
				onTemplateSelect={handleTemplateSelect}
				onUploadSuccess={handleUploadSuccess}
				onTabChange={setActiveTab}
			/>
		</div>
	);
}
