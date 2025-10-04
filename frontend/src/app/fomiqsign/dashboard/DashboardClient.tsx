"use client";

import { useState } from "react";
import { Upload, FileText, Eye, BarChart3, History, Settings, Activity } from "lucide-react";
import { DocuSignTemplateData, SignatureField } from "@/types/docusign";
import apiClient from "@/lib/apiClient";
import { PDFUpload } from "@/components/docusign/PDFUpload";
import { TemplateList } from "@/components/docusign/TemplateList";
import { MultiPageTemplateViewer } from "@/components/docusign/MultiPageTemplateViewer";
import { SignatureTracking } from "@/components/docusign/SignatureTracking";

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
interface DashboardClientProps {}

type TabType = "upload" | "templates" | "viewer" | "status" | "activity" | "tracking" | "settings";

interface Tab {
	id: TabType;
	label: string;
	icon: React.ComponentType<{ className?: string }>;
	description: string;
}

const tabs: Tab[] = [
	{
		id: "upload",
		label: "Upload PDF",
		icon: Upload,
		description: "Upload and process PDF documents",
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
	{
		id: "settings",
		label: "Settings",
		icon: Settings,
		description: "Configure FomiqSign preferences",
	},
];

export default function DashboardClient({}: DashboardClientProps) {
	const [activeTab, setActiveTab] = useState<TabType>("upload");
	const [selectedTemplate, setSelectedTemplate] = useState<DocuSignTemplateData | null>(null);
	const [recipients, setRecipients] = useState<Array<{ id: string; name: string; email?: string }>>([]);
	const [messageSubject, setMessageSubject] = useState("Please sign this document");
	const [messageBody, setMessageBody] = useState("Please review and sign the highlighted fields.");

	// React Query for data fetching
	// Activities query removed for now

	const handleTemplateSelect = (template: DocuSignTemplateData) => {
		setSelectedTemplate(template);
		if (activeTab === "templates") {
			setActiveTab("viewer");
		}
	};

	const handleUploadSuccess = (template: DocuSignTemplateData) => {
		setSelectedTemplate(template);
		setActiveTab("viewer");
	};

	const renderTabContent = () => {
		switch (activeTab) {
			case "upload":
				return (
					<div className="space-y-6">
						<div>
							<h2 className="text-2xl font-semibold text-gray-100 mb-2">Upload PDF Document</h2>
							<p className="text-gray-300">
								Upload a PDF file to create a new FomiqSign template. The system will automatically
								convert it to images and prepare it for signature placement.
							</p>
						</div>
						<PDFUpload onUploadSuccess={handleUploadSuccess} />
					</div>
				);

			case "templates":
				return (
					<div>
						<h2 className="text-2xl font-semibold text-white mb-4">Templates</h2>
						<TemplateList onViewTemplate={handleTemplateSelect} />
					</div>
				);

			case "viewer":
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
													signatureFields: (prev.signatureFields || []).filter((f) => f.id !== fieldId),
												};
											});
										}}
										onFieldUpdate={(pageNumber: number, fieldId: string, patch: Partial<SignatureField>) => {
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

								<div className="mt-4 md:mt-0 md:w-96 lg:w-96 bg-gray-900/20 p-5 rounded-lg shadow-inner sticky top-20 max-h-[70vh] overflow-auto">
									<h3 className="text-lg font-medium text-gray-100 mb-3">Recipients</h3>
									<RecipientsManager recipients={recipients} setRecipients={setRecipients} />
									<hr className="my-4 border-gray-700" />
									<h3 className="text-lg font-medium text-gray-100 mb-3">Message</h3>
									<MessageComposer subject={messageSubject} body={messageBody} setSubject={setMessageSubject} setBody={setMessageBody} />
									<hr className="my-4 border-gray-700" />
									<FinalizePanel template={selectedTemplate} recipients={recipients} subject={messageSubject} body={messageBody} />
								</div>
							</>
						) : (
							<div className="text-center py-12 col-span-3">
								<FileText className="mx-auto h-12 w-12 text-gray-400 mb-4" />
								<h3 className="text-lg font-medium text-white mb-2">No Template Selected</h3>
								<p className="text-gray-400 mb-4">Select a template from the Templates tab to view and edit it.</p>
								<button onClick={() => setActiveTab("templates")} className="btn btn-primary">
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
						{/* Status tracker component will be implemented */}
						<div className="text-center py-12">
							<BarChart3 className="mx-auto h-12 w-12 text-gray-400 mb-4" />
							<h3 className="text-lg font-medium text-white mb-2">Status Tracking</h3>
							<p className="text-gray-400">Status tracking component coming soon...</p>
						</div>
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
						{/* Activity logs component will be implemented */}
						<div className="text-center py-12">
							<History className="mx-auto h-12 w-12 text-gray-400 mb-4" />
							<h3 className="text-lg font-medium text-white mb-2">Activity Logs</h3>
							<p className="text-gray-400">Activity logs component coming soon...</p>
						</div>
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
								<button onClick={() => setActiveTab("templates")} className="btn btn-primary">
									Select Template
								</button>
							</div>
						)}
					</div>
				);

			case "settings":
				return (
					<div className="space-y-6">
						<div>
							<h2 className="text-2xl font-semibold text-white mb-2">FomiqSign Settings</h2>
							<p className="text-gray-400">
								Configure your FomiqSign preferences and system settings.
							</p>
						</div>
						{/* Settings component will be implemented */}
						<div className="text-center py-12">
							<Settings className="mx-auto h-12 w-12 text-gray-400 mb-4" />
							<h3 className="text-lg font-medium text-white mb-2">Settings</h3>
							<p className="text-gray-400">Settings panel coming soon...</p>
						</div>
					</div>
				);

			default:
				return null;
		}
	};

	return (
		<div className="space-y-6">
			{/* Tab Navigation */}
			<div className="flex flex-wrap gap-1 bg-gray-800/50 p-1 rounded-lg">
				{tabs.map((tab) => {
					const Icon = tab.icon;
					const isActive = activeTab === tab.id;

					return (
						<button
							key={tab.id}
							onClick={() => setActiveTab(tab.id)}
							className={`flex-1 min-w-0 px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
								isActive
									? "bg-blue-600 text-white shadow-lg"
									: "text-gray-300 hover:text-white hover:bg-gray-700/50"
							}`}
							title={tab.description}
						>
							<div className="flex flex-col items-center gap-1">
								<Icon className="h-4 w-4" />
								<span className="hidden sm:inline text-xs">{tab.label}</span>
							</div>
						</button>
					);
				})}
			</div>

			{/* Tab Content */}
			<div className="bg-gray-800/50 rounded-lg p-6">{renderTabContent()}</div>
		</div>
	);
}

// Simple recipients manager - inline for now
function RecipientsManager({
	recipients,
	setRecipients,
}: {
	recipients: Array<{ id: string; name: string; email?: string }>;
	setRecipients: React.Dispatch<React.SetStateAction<Array<{ id: string; name: string; email?: string }>>>;
}) {
	const [name, setName] = useState("");
	const [email, setEmail] = useState("");

	const add = () => {
		if (!name.trim()) return;
		setRecipients((r) => [...r, { id: `${Date.now()}-${Math.random()}`, name: name.trim(), email: email.trim() || undefined }]);
		setName("");
		setEmail("");
	};

	const remove = (id: string) => setRecipients((r) => r.filter((x) => x.id !== id));

	return (
		<div>
			<div className="space-y-3">
				<input className="w-full px-3 py-2 rounded-md bg-gray-800 text-gray-100 border border-gray-700" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
				<input className="w-full px-3 py-2 rounded-md bg-gray-800 text-gray-100 border border-gray-700" placeholder="Email (optional)" value={email} onChange={(e) => setEmail(e.target.value)} />
				<div className="flex gap-2">
					<button className="px-3 py-2 rounded-md bg-blue-600 hover:bg-blue-700 text-white font-medium" onClick={add}>Add Recipient</button>
				</div>
			</div>
			<ul className="mt-3 space-y-2 text-sm">
				{recipients.map((r) => (
					<li key={r.id} className="flex justify-between items-center">
						<div>
							<div className="font-medium text-gray-100">{r.name}</div>
							{r.email && <div className="text-xs text-gray-400">{r.email}</div>}
						</div>
						<button className="text-sm text-red-400" onClick={() => remove(r.id)}>Remove</button>
					</li>
				))}
				{recipients.length === 0 && <li className="text-xs text-gray-400">No recipients yet</li>}
			</ul>
		</div>
	);
}

// Message composer for subject/body - inline
function MessageComposer({
	subject,
	body,
	setSubject,
	setBody,
}: {
	subject: string;
	body: string;
	setSubject: React.Dispatch<React.SetStateAction<string>>;
	setBody: React.Dispatch<React.SetStateAction<string>>;
}) {
	return (
		<div className="space-y-3">
			<input className="w-full px-3 py-2 rounded-md bg-gray-800 text-gray-100 border border-gray-700" placeholder="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
			<textarea className="w-full px-3 py-2 rounded-md bg-gray-800 text-gray-100 border border-gray-700 h-28" placeholder="Message body" value={body} onChange={(e) => setBody(e.target.value)} />
		</div>
	);
}

// Finalize panel: collects fields and posts to apply-signatures
function FinalizePanel({ template, recipients, subject, body }: { template: DocuSignTemplateData; recipients: Array<{ id: string; name: string; email?: string }>; subject: string; body: string; }) {
	const [loading, setLoading] = useState(false);
	const [resultUrls, setResultUrls] = useState<string[] | null>(null);

	const generate = async () => {
		if (!template) return;
		setLoading(true);
			try {
				// The backend expects signature images + fields; include recipients and message
				const payload = {
					fields: template.signatureFields || [],
					signatures: [],
					recipients: recipients || [],
					message: { subject: subject || "", body: body || "" },
					// Request A4 final output at 300 DPI (approx 2480 x 3508 px)
					outputSize: { width: 2480, height: 3508 },
					dpi: 300,
					viewport: { width: 2480, height: 3508 },
				};

			const res = await apiClient.post(`/fomiqsign/${template._id}/apply-signatures`, payload);
			// backend may return signed pages array or urls - handle safely without using `any`
			if (res && typeof res === "object") {
				const r = res as Record<string, unknown>;
				if (Array.isArray(r.signedPages)) {
					const urls = (r.signedPages as unknown[])
						.map((p) => {
							if (p && typeof p === "object") {
								const obj = p as Record<string, unknown>;
								return (obj.url as string) || (obj.imageUrl as string) || "";
							}
							return String(p);
						})
						.filter(Boolean) as string[];
					setResultUrls(urls);
				} else if (Array.isArray(r.signedPageUrls)) {
					setResultUrls(r.signedPageUrls as string[]);
				} else if (typeof r.signedUrl === "string") {
					setResultUrls([r.signedUrl as string]);
				} else if (Array.isArray(res)) {
					setResultUrls(res as string[]);
				} else {
					setResultUrls([]);
				}
			} else if (Array.isArray(res)) {
				setResultUrls(res as string[]);
			} else {
				setResultUrls([]);
			}
		} catch (err) {
			// show basic error in console for now
			console.error("Failed to generate signed document", err);
			setResultUrls([]);
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className="space-y-3">
			<button className="w-full px-4 py-3 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white font-semibold" onClick={generate} disabled={loading}>
				{loading ? "Generating..." : "Finalize & Generate"}
			</button>
			<div className="mt-2">
				{resultUrls === null ? null : resultUrls.length === 0 ? (
					<div className="text-sm text-yellow-300">No signed pages returned.</div>
				) : (
					<ul className="space-y-2">
						{resultUrls.map((u, idx) => (
							<li key={idx}><a className="text-sm text-blue-200 underline" href={u} target="_blank" rel="noreferrer">Signed Page {idx + 1}</a></li>
						))}
					</ul>
				)}
			</div>
		</div>
	);
}
