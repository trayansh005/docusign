"use client";

import ActivityClient from "@/app/fomiqsign/activity/ActivityClient";
import StatusTrackerClient from "@/app/fomiqsign/status-tracker/StatusTrackerClient";
import { MultiPageTemplateViewer } from "@/components/docusign/MultiPageTemplateViewer";
import { PDFUpload } from "@/components/docusign/PDFUpload";
import { SignatureTracking } from "@/components/docusign/SignatureTracking";
import { TemplateList } from "@/components/docusign/TemplateList";
import { DocuSignTemplateData, SignatureField } from "@/types/docusign";
import { Activity, FileText } from "lucide-react";
import dynamic from "next/dynamic";
import { FinalizePanel } from "./FinalizePanel";
import { MessageComposer } from "./MessageComposer";
import { RecipientsManager } from "./RecipientsManager";
import { Recipient, TabType } from "./types";

// Dynamically import SignedDocumentViewer to avoid SSR issues with DOMMatrix
const SignedDocumentViewer = dynamic(
	() =>
		import("@/components/docusign/SignedDocumentViewer").then((mod) => ({
			default: mod.SignedDocumentViewer,
		})),
	{
		ssr: false,
		loading: () => (
			<div className="flex items-center justify-center p-8 min-h-[600px] bg-gray-100">
				<div className="text-gray-600">Loading PDF viewer...</div>
			</div>
		),
	}
);

interface DashboardTabsProps {
	activeTab: TabType;
	selectedTemplate: DocuSignTemplateData | null;
	recipients: Recipient[];
	messageSubject: string;
	messageBody: string;
	resultUrls: string[] | null;
	onTemplateSelect: (template: DocuSignTemplateData) => void;
	onUploadSuccess: (template: DocuSignTemplateData) => void;
	onTabChange: (tab: TabType) => void;
	setSelectedTemplate: React.Dispatch<React.SetStateAction<DocuSignTemplateData | null>>;
	setRecipients: React.Dispatch<React.SetStateAction<Recipient[]>>;
	setMessageSubject: React.Dispatch<React.SetStateAction<string>>;
	setMessageBody: React.Dispatch<React.SetStateAction<string>>;
	setResultUrls: React.Dispatch<React.SetStateAction<string[] | null>>;
}

export function DashboardTabs({
	activeTab,
	selectedTemplate,
	recipients,
	messageSubject,
	messageBody,
	resultUrls,
	onTemplateSelect,
	onUploadSuccess,
	onTabChange,
	setSelectedTemplate,
	setRecipients,
	setMessageSubject,
	setMessageBody,
	setResultUrls,
}: DashboardTabsProps) {
	const renderTabContent = () => {
		switch (activeTab) {
			case "upload":
				return (
					<div className="space-y-6">
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
					<div>
						<h2 className="text-2xl font-semibold text-white mb-4">Templates</h2>
						<TemplateList onViewTemplate={onTemplateSelect} />
					</div>
				);

			case "viewer":
				// If we have final PDF results, show full-page success view instead
				if (resultUrls && resultUrls.length > 0) {
					return (
						<SignedDocumentViewer
							pdfUrl={resultUrls[0]}
							onBack={() => {
								setResultUrls(null);
								setSelectedTemplate(null);
								onTabChange("templates");
							}}
						/>
					);
				}

				return (
					<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
						{selectedTemplate ? (
							<>
								<div className="col-span-2">
									<MultiPageTemplateViewer
										template={selectedTemplate}
										editable={true}
										onFieldAdd={(pageNumber: number, newField: Omit<SignatureField, "id">) => {
											setSelectedTemplate((prev) => {
												if (!prev) return prev;
												const id = `${Date.now()}-${Math.random()}`;
												return {
													...prev,
													signatureFields: [...(prev.signatureFields || []), { ...newField, id }],
												};
											});
										}}
										onFieldRemove={(pageNumber: number, fieldId: string) => {
											setSelectedTemplate((prev) => {
												if (!prev) return prev;
												return {
													...prev,
													signatureFields: (prev.signatureFields || []).filter(
														(f) => f.id !== fieldId
													),
												};
											});
										}}
										onFieldUpdate={(
											pageNumber: number,
											fieldId: string,
											patch: Partial<SignatureField>
										) => {
											setSelectedTemplate((prev) => {
												if (!prev) return prev;
												return {
													...prev,
													signatureFields: (prev.signatureFields || []).map((f) =>
														f.id === fieldId ? { ...f, ...patch } : f
													),
												};
											});
										}}
									/>
								</div>

								<div className="mt-4 md:mt-0 md:w-96 lg:w-96 bg-gray-900/20 p-5 rounded-lg shadow-inner sticky top-20">
									<h3 className="text-lg font-medium text-gray-100 mb-3">Recipients</h3>
									<RecipientsManager recipients={recipients} setRecipients={setRecipients} />
									<hr className="my-4 border-gray-700" />
									<h3 className="text-lg font-medium text-gray-100 mb-3">Message</h3>
									<MessageComposer
										subject={messageSubject}
										body={messageBody}
										setSubject={setMessageSubject}
										setBody={setMessageBody}
									/>
									<hr className="my-4 border-gray-700" />
									<FinalizePanel
										template={selectedTemplate}
										recipients={recipients}
										subject={messageSubject}
										body={messageBody}
										onSuccess={(urls) => setResultUrls(urls)}
									/>
								</div>
							</>
						) : (
							<div className="text-center py-12 col-span-3">
								<FileText className="mx-auto h-12 w-12 text-gray-400 mb-4" />
								<h3 className="text-lg font-medium text-white mb-2">No Template Selected</h3>
								<p className="text-gray-400 mb-4">
									Select a template from the Templates tab to view and edit it.
								</p>
								<button onClick={() => onTabChange("templates")} className="btn btn-primary">
									Browse Templates
								</button>
							</div>
						)}
					</div>
				);

			case "status":
				return (
					<div className="space-y-6">
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
					<div className="space-y-6">
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
					<div className="space-y-6">
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

	return <div className="bg-gray-800/50 rounded-lg p-6">{renderTabContent()}</div>;
}
