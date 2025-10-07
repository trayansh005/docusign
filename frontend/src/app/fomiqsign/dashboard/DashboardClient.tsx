"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import {
	Upload,
	FileText,
	Eye,
	BarChart3,
	History,
	Settings,
	Activity,
	CheckCircle,
} from "lucide-react";
import { DocuSignTemplateData, SignatureField } from "@/types/docusign";
import apiClient from "@/lib/apiClient";
import { PDFUpload } from "@/components/docusign/PDFUpload";
import { TemplateList } from "@/components/docusign/TemplateList";
import { MultiPageTemplateViewer } from "@/components/docusign/MultiPageTemplateViewer";
import { SignatureTracking } from "@/components/docusign/SignatureTracking";
import { useAuth } from "@/contexts/AuthContext";

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
	const [recipients, setRecipients] = useState<Array<{ id: string; name: string; email?: string }>>(
		[]
	);
	const [messageSubject, setMessageSubject] = useState("Please sign this document");
	const [messageBody, setMessageBody] = useState("Please review and sign the highlighted fields.");
	const [resultUrls, setResultUrls] = useState<string[] | null>(null);

	// React Query for data fetching
	// Activities query removed for now

	const handleTemplateSelect = (template: DocuSignTemplateData) => {
		if (!template) {
			console.error("Template selection failed: template is undefined");
			return;
		}
		if (!template._id) {
			console.error("Template selection failed: template missing _id");
			return;
		}
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
				// If we have final PDF results, show full-page success view instead
				if (resultUrls && resultUrls.length > 0) {
					return (
						<SignedDocumentViewer
							pdfUrl={resultUrls[0]}
							onBack={() => {
								setResultUrls(null);
								setSelectedTemplate(null);
								setActiveTab("templates");
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

								<div className="mt-4 md:mt-0 md:w-96 lg:w-96 bg-gray-900/20 p-5 rounded-lg shadow-inner sticky top-20 max-h-[70vh] overflow-auto">
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

// Recipients Manager Component
function RecipientsManager({
	recipients,
	setRecipients,
}: {
	recipients: Array<{ id: string; name: string; email?: string }>;
	setRecipients: React.Dispatch<
		React.SetStateAction<Array<{ id: string; name: string; email?: string }>>
	>;
}) {
	const [name, setName] = useState("");
	const [email, setEmail] = useState("");

	const add = () => {
		if (!name.trim()) return;
		setRecipients((r) => [
			...r,
			{ id: `${Date.now()}-${Math.random()}`, name: name.trim(), email: email.trim() || undefined },
		]);
		setName("");
		setEmail("");
	};

	const remove = (id: string) => setRecipients((r) => r.filter((x) => x.id !== id));

	return (
		<div>
			<div className="space-y-3">
				<input
					className="w-full px-3 py-2 rounded-md bg-gray-800 text-gray-100 border border-gray-700"
					placeholder="Name"
					value={name}
					onChange={(e) => setName(e.target.value)}
				/>
				<input
					className="w-full px-3 py-2 rounded-md bg-gray-800 text-gray-100 border border-gray-700"
					placeholder="Email (optional)"
					value={email}
					onChange={(e) => setEmail(e.target.value)}
				/>
				<div className="flex gap-2">
					<button
						className="px-3 py-2 rounded-md bg-blue-600 hover:bg-blue-700 text-white font-medium"
						onClick={add}
					>
						Add Recipient
					</button>
				</div>
			</div>
			<ul className="mt-3 space-y-2 text-sm">
				{recipients.map((r) => (
					<li key={r.id} className="flex justify-between items-center">
						<div>
							<div className="font-medium text-gray-100">{r.name}</div>
							{r.email && <div className="text-xs text-gray-400">{r.email}</div>}
						</div>
						<button className="text-sm text-red-400" onClick={() => remove(r.id)}>
							Remove
						</button>
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
			<input
				className="w-full px-3 py-2 rounded-md bg-gray-800 text-gray-100 border border-gray-700"
				placeholder="Subject"
				value={subject}
				onChange={(e) => setSubject(e.target.value)}
			/>
			<textarea
				className="w-full px-3 py-2 rounded-md bg-gray-800 text-gray-100 border border-gray-700 h-28"
				placeholder="Message body"
				value={body}
				onChange={(e) => setBody(e.target.value)}
			/>
		</div>
	);
}

// Finalize panel: collects fields and posts to apply-signatures
function FinalizePanel({
	template,
	recipients,
	subject,
	body,
	onSuccess,
}: {
	template: DocuSignTemplateData;
	recipients: Array<{ id: string; name: string; email?: string }>;
	subject: string;
	body: string;
	onSuccess?: (urls: string[]) => void;
}) {
	const [loading, setLoading] = useState(false);
	const [resultUrls, setResultUrls] = useState<string[] | null>(null);

	// Get logged-in user for signature text
	const { user } = useAuth();
	const userFullName =
		user?.firstName && user?.lastName ? `${user.firstName} ${user.lastName}` : "Your Signature";
	const userInitials =
		user?.firstName && user?.lastName ? `${user.firstName[0]}${user.lastName[0]}` : "YI";

	/**
	 * Generate signature image from text and font with proper sizing
	 */
	const generateSignatureImage = async (
		text: string,
		fontFamily: string,
		width: number,
		height: number
	): Promise<string> => {
		return new Promise((resolve) => {
			const canvas = document.createElement("canvas");
			const ctx = canvas.getContext("2d");
			if (!ctx) {
				resolve("");
				return;
			}

			// Set canvas size with higher resolution for quality (2x for retina)
			const scale = 2;
			canvas.width = width * scale;
			canvas.height = height * scale;
			ctx.scale(scale, scale);

			// Clear canvas with transparent background
			ctx.clearRect(0, 0, canvas.width, canvas.height);

			// Calculate optimal font size based on text length and field dimensions
			// Start with 70% of height, then adjust based on text width
			let fontSize = height * 0.7;
			ctx.font = `${fontSize}px ${fontFamily}`;

			// Measure text width and scale down if it exceeds field width
			let textMetrics = ctx.measureText(text);
			const padding = width * 0.1; // 10% padding on each side
			const maxTextWidth = width - padding * 2;

			if (textMetrics.width > maxTextWidth) {
				// Scale font size down proportionally
				fontSize = fontSize * (maxTextWidth / textMetrics.width);
				ctx.font = `${fontSize}px ${fontFamily}`;
				textMetrics = ctx.measureText(text);
			}

			// Set text styling
			ctx.fillStyle = "#000000";
			ctx.textBaseline = "middle";
			ctx.textAlign = "center";

			// Draw text centered both horizontally and vertically
			const centerX = width / 2;
			const centerY = height / 2;
			ctx.fillText(text, centerX, centerY);

			// Convert to data URL
			resolve(canvas.toDataURL("image/png"));
		});
	};

	/**
	 * Get font family from fontId
	 */
	const getFontFamily = (fontId?: string): string => {
		const fontMap: Record<string, string> = {
			"dancing-script": "'Dancing Script', cursive",
			"great-vibes": "'Great Vibes', cursive",
			allura: "'Allura', cursive",
			"alex-brush": "'Alex Brush', cursive",
			"amatic-sc": "'Amatic SC', cursive",
			caveat: "'Caveat', cursive",
			"kaushan-script": "'Kaushan Script', cursive",
			pacifico: "'Pacifico', cursive",
			satisfy: "'Satisfy', cursive",
			"permanent-marker": "'Permanent Marker', cursive",
		};
		return fontMap[fontId || "dancing-script"] || "'Dancing Script', cursive";
	};

	const generate = async () => {
		if (!template) return;
		setLoading(true);
		try {
			// Generate signature images for each field
			const signaturePromises = template.signatureFields
				.filter((field) => field.type === "signature" || field.type === "initial")
				.map(async (field) => {
					// Use the same logic as the field display:
					// 1. If field.value exists, use it
					// 2. Else if initial field, use userInitials
					// 3. Else (signature field), use userFullName
					const text =
						field.value && field.value.length > 0
							? field.value
							: field.type === "initial"
							? userInitials
							: userFullName;

					const fontFamily = getFontFamily(field.fontId);
					const width = Math.round((field.wPct / 100) * 800); // Assume 800px viewport width
					const height = Math.round((field.hPct / 100) * 1131); // Assume A4 aspect ratio

					const imageDataUrl = await generateSignatureImage(text, fontFamily, width, height);

					return {
						id: field.id,
						fieldId: field.id,
						recipientId: field.recipientId,
						type: field.type,
						pageNumber: field.pageNumber,
						signatureImageBuffer: imageDataUrl,
						image: imageDataUrl,
						index: template.signatureFields.indexOf(field),
					};
				});

			const signatures = await Promise.all(signaturePromises);

			// The backend expects signature images + fields; include recipients and message
			const payload = {
				fields: template.signatureFields || [],
				signatures: signatures,
				recipients: recipients || [],
				message: { subject: subject || "", body: body || "" },
				// Request A4 final output at 300 DPI (approx 2480 x 3508 px)
				outputSize: { width: 2480, height: 3508 },
				dpi: 300,
				viewport: { width: 800, height: 1131 }, // Match generation viewport
			};

			console.log(`Sending ${signatures.length} signature images to backend`);

			const res = await apiClient.post(`/docusign/${template._id}/apply-signatures`, payload);

			// Helper to convert backend path to absolute URL
			const toAbsoluteUrl = (url: string | undefined | null) => {
				if (!url || typeof url !== "string") return "";
				if (url.startsWith("http://") || url.startsWith("https://")) return url;
				// Backend is at localhost:5000, paths like /uploads/... need http://localhost:5000/api
				const backendBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";
				// Remove /api if it's there, then add it back with the path
				const baseWithoutApi = backendBase.replace(/\/api$/, "");
				const cleanPath = url.startsWith("/") ? url : `/${url}`;
				return `${baseWithoutApi}/api${cleanPath}`;
			}; // Prefer new shape: { success, data: { finalPdfUrl } }
			if (res && typeof res === "object") {
				const r = res as Record<string, unknown>;
				const data = (r.data as Record<string, unknown>) || {};
				// Prefer direct finalPdfUrl; also accept nested data.finalPdf.url
				const finalPdf = (data.finalPdf as Record<string, unknown>) || {};
				const finalPdfUrl =
					(typeof data.finalPdfUrl === "string" && data.finalPdfUrl) ||
					(typeof finalPdf.url === "string" && finalPdf.url) ||
					(r.finalPdfUrl as string) ||
					"";
				if (typeof finalPdfUrl === "string" && finalPdfUrl.length > 0) {
					const absoluteUrl = toAbsoluteUrl(finalPdfUrl);
					setResultUrls([absoluteUrl]);
					onSuccess?.([absoluteUrl]);
				} else if (Array.isArray(r.signedPages)) {
					const urls = (r.signedPages as unknown[])
						.map((p) => {
							if (p && typeof p === "object") {
								const obj = p as Record<string, unknown>;
								return (obj.url as string) || (obj.imageUrl as string) || (obj.src as string) || "";
							}
							return String(p);
						})
						.filter(Boolean)
						.map(toAbsoluteUrl) as string[];
					setResultUrls(urls);
				} else if (Array.isArray(r.signedPageUrls)) {
					setResultUrls((r.signedPageUrls as string[]).map(toAbsoluteUrl));
				} else if (typeof r.signedUrl === "string") {
					setResultUrls([toAbsoluteUrl(r.signedUrl)]);
				} else if (typeof (r.url as string) === "string") {
					setResultUrls([toAbsoluteUrl(r.url as string)]);
				} else if (Array.isArray(res)) {
					setResultUrls((res as string[]).map(toAbsoluteUrl));
				} else {
					setResultUrls([]);
				}
			} else if (Array.isArray(res)) {
				setResultUrls((res as string[]).map(toAbsoluteUrl));
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
			<button
				className="w-full px-4 py-3 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white font-semibold"
				onClick={generate}
				disabled={loading}
			>
				{loading ? "Generating..." : "Finalize & Generate"}
			</button>
			<div className="mt-2">
				{resultUrls === null ? null : resultUrls.length === 0 ? (
					<div className="text-sm text-yellow-300">No signed pages returned.</div>
				) : (
					<div className="rounded-lg border border-green-200 bg-green-50 p-4">
						<div className="flex items-start gap-3">
							<CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
							<div>
								<div className="text-green-800 font-semibold">
									Signed document generated successfully
								</div>
								<p className="text-sm text-green-700 mt-1">
									Your final PDF with signatures is ready. You can open it in a new tab or view it
									inline below.
								</p>
								<div className="mt-3 flex items-center gap-3">
									<a
										className="inline-flex items-center rounded-md bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-700"
										href={resultUrls[0]}
										target="_blank"
										rel="noreferrer"
									>
										Open Final PDF
									</a>
									<a
										className="inline-flex items-center rounded-md border border-green-300 px-3 py-2 text-sm font-medium text-green-800 hover:bg-green-100"
										href={resultUrls[0]}
										download
									>
										Download
									</a>
								</div>
							</div>
						</div>

						<div className="mt-4">
							<iframe
								src={resultUrls[0]}
								title="Signed PDF Preview"
								className="w-full h-96 rounded-md border"
							/>
							<p className="text-xs text-gray-500 mt-2">
								If the preview doesn’t render, click “Open Final PDF” to view in a new tab.
							</p>
						</div>
					</div>
				)}
			</div>
		</div>
	);
}
