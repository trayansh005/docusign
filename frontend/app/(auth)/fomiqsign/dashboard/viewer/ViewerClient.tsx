"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { MapPin, ChevronLeft } from "lucide-react";
import { DocuSignTemplateData, SignatureField } from "@/types/docusign";
import apiClient from "@/lib/apiClient";
import { RecipientsManager } from "@/components/FomiqDashboard/RecipientsManager";
import { MessageComposer } from "@/components/FomiqDashboard/MessageComposer";
import { FinalizePanel } from "@/components/FomiqDashboard/FinalizePanel";
import { Recipient } from "@/components/FomiqDashboard/types";
import { useAuthStore } from "@/stores/authStore";

// Dynamically import PDF components to avoid SSR issues
const MultiPageTemplateViewer = dynamic(
	() =>
		import("@/components/docusign/MultiPageTemplateViewer").then((mod) => ({
			default: mod.MultiPageTemplateViewer,
		})),
	{
		ssr: false,
		loading: () => (
			<div className="flex items-center justify-center min-h-screen">
				<div className="text-gray-600">Loading viewer...</div>
			</div>
		),
	}
);

const PDFThumbnail = dynamic(
	() => import("@/components/docusign/PDFThumbnail").then((mod) => ({ default: mod.PDFThumbnail })),
	{ ssr: false }
);

export default function ViewerClient() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const templateId = searchParams.get("templateId");
	const user = useAuthStore((state) => state.user);

	const [selectedTemplate, setSelectedTemplate] = useState<DocuSignTemplateData | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [activeSignatureField, setActiveSignatureField] = useState<SignatureField | null>(null);
	const [recipients, setRecipients] = useState<Recipient[]>([]);
	const [messageSubject, setMessageSubject] = useState("Please sign this document");
	const [messageBody, setMessageBody] = useState("Please review and sign the highlighted fields.");
	const [showMarkPlaceDialog, setShowMarkPlaceDialog] = useState(false);
	const [selectedRecipient, setSelectedRecipient] = useState<Recipient | null>(null);
	const [selectedFieldType, setSelectedFieldType] = useState<string | null>(null);
	const [isMarkingMode, setIsMarkingMode] = useState(false);
	const [currentPage, setCurrentPage] = useState(1);

	// Check if sender has signed (required before marking places)
	const hasSenderSigned = useCallback(() => {
		if (!selectedTemplate?.signatureFields) return false;

		const userEmail = user?.email;
		const userId = user?.id;

		const senderFields = selectedTemplate.signatureFields.filter((field) => {
			if (field.placeholder) return false;
			if (field.type !== "signature" && field.type !== "initial") return false;

			return (
				field.recipientId === userEmail ||
				field.recipientId === userId ||
				field.recipientId === "current-user" ||
				field.recipientId?.includes("current-user") ||
				!field.recipientId
			);
		});

		return senderFields.length > 0;
	}, [selectedTemplate?.signatureFields, user]);

	useEffect(() => {
		if (!templateId) {
			setError("No template ID provided");
			setLoading(false);
			return;
		}

		const fetchTemplate = async () => {
			try {
				console.log("Fetching template with ID:", templateId);
				const response = await apiClient.get(`/docusign/${templateId}`);
				console.log("Template response:", response);

				if (response && typeof response === "object") {
					// The API returns { success: true, data: template }
					if ("data" in response) {
						setSelectedTemplate(response.data as DocuSignTemplateData);
					} else if ("template" in response) {
						// Fallback for old API format
						setSelectedTemplate(response.template as DocuSignTemplateData);
					} else {
						setError("Invalid response format from server");
					}
				} else {
					setError("Invalid response from server");
				}
			} catch (err) {
				console.error("Failed to fetch template:", err);
				setError(err instanceof Error ? err.message : "Failed to load template");
			} finally {
				setLoading(false);
			}
		};

		fetchTemplate();
	}, [templateId]);

	const handleBack = () => {
		// Go back in history if possible; falls back to dashboard route if no history
		try {
			router.back();
		} catch {
			router.push("/fomiqsign/dashboard");
		}
	};

	const handleFieldTypeSelect = (fieldType: string) => {
		if (!hasSenderSigned()) {
			return;
		}

		// If no recipient selected, do nothing (user must select a recipient first)
		if (!selectedRecipient) {
			return;
		}

		// Set field type and activate marking mode
		setSelectedFieldType(fieldType);
		setIsMarkingMode(true);
		console.log(
			`Marking mode activated for ${fieldType} field for recipient: ${selectedRecipient.name}`
		);
	};

	if (loading) {
		return (
			<div className="flex items-center justify-center min-h-screen bg-gray-100">
				<div className="text-gray-600">Loading template...</div>
			</div>
		);
	}

	if (error || !selectedTemplate) {
		return (
			<div className="flex items-center justify-center min-h-screen bg-gray-100">
				<div className="text-center">
					<p className="text-red-600 mb-4">{error || "Template not found"}</p>
					<button
						onClick={handleBack}
						className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
					>
						Back to Dashboard
					</button>
				</div>
			</div>
		);
	}

	return (
		<div className="h-screen flex flex-col bg-gray-900">
			{/* Main Content */}
			<div className="flex-1 flex overflow-hidden">
				{/* Left Sidebar - Mark Place UI */}
				<div className="w-80 bg-white border-r border-gray-200 flex flex-col overflow-hidden">
					{/* Mark Place Header */}
					<div className="p-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-blue-100">
						<div className="flex items-center gap-2 mb-1">
							<button
								onClick={handleBack}
								aria-label="Go back"
								className="p-1 rounded hover:bg-gray-200"
							>
								<ChevronLeft className="w-4 h-4 text-gray-700" />
							</button>
							<MapPin className="w-5 h-5 text-blue-600" />
							<h3 className="text-lg font-semibold text-gray-900">Mark Place</h3>
						</div>
						<p className="text-xs text-gray-600">
							{hasSenderSigned()
								? "Add fields for recipients by clicking on the document"
								: "Sign the document first before marking places for recipients"}
						</p>
					</div>

					{/* Recipients Manager */}
					<div className="border-b border-gray-200">
						<RecipientsManager
							recipients={recipients}
							setRecipients={setRecipients}
							selectedRecipient={selectedRecipient}
							onRecipientSelect={setSelectedRecipient}
						/>
					</div>

					{/* Field Types Section */}
					<div className="flex-1 overflow-y-auto p-4">
						<h4 className="text-xs font-semibold text-gray-700 mb-3 uppercase tracking-wide">
							Add Fields by Placing on Document:
						</h4>

						{!hasSenderSigned() && (
							<div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
								<p className="text-xs text-yellow-800">
									⚠️ You must add your signature to the document before marking places for
									recipients.
								</p>
							</div>
						)}

						{hasSenderSigned() && !selectedRecipient && (
							<div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
								<p className="text-xs text-blue-800">
									👉 Select a recipient from the list above to place fields for them.
								</p>
							</div>
						)}

						<div className="grid grid-cols-2 gap-2">
							<button
								onClick={() => handleFieldTypeSelect("signature")}
								disabled={!hasSenderSigned() || !selectedRecipient}
								className={`w-full flex items-center gap-3 p-3 text-left rounded-lg transition-all border ${
									selectedFieldType === "signature" && isMarkingMode
										? "bg-blue-100 border-blue-500"
										: hasSenderSigned() && selectedRecipient
										? "hover:bg-blue-50 hover:border-blue-200 border-transparent"
										: "opacity-50 cursor-not-allowed border-transparent"
								}`}
							>
								<span className="text-2xl">✍️</span>
								<div>
									<div className="text-sm font-medium text-gray-800">Signature</div>
								</div>
							</button>

							<button
								onClick={() => handleFieldTypeSelect("initial")}
								disabled={!hasSenderSigned() || !selectedRecipient}
								className={`w-full flex items-center gap-3 p-3 text-left rounded-lg transition-all border ${
									selectedFieldType === "initial" && isMarkingMode
										? "bg-blue-100 border-blue-500"
										: hasSenderSigned() && selectedRecipient
										? "hover:bg-blue-50 hover:border-blue-200 border-transparent"
										: "opacity-50 cursor-not-allowed border-transparent"
								}`}
							>
								<span className="text-2xl">📝</span>
								<div>
									<div className="text-sm font-medium text-gray-800">Initials</div>
								</div>
							</button>

							<button
								onClick={() => handleFieldTypeSelect("name")}
								disabled={!hasSenderSigned() || !selectedRecipient}
								className={`w-full flex items-center gap-3 p-3 text-left rounded-lg transition-all border ${
									selectedFieldType === "name" && isMarkingMode
										? "bg-blue-100 border-blue-500"
										: hasSenderSigned() && selectedRecipient
										? "hover:bg-blue-50 hover:border-blue-200 border-transparent"
										: "opacity-50 cursor-not-allowed border-transparent"
								}`}
							>
								<span className="text-2xl">👤</span>
								<div>
									<div className="text-sm font-medium text-gray-800">Full Name</div>
								</div>
							</button>

							<button
								onClick={() => handleFieldTypeSelect("email")}
								disabled={!hasSenderSigned() || !selectedRecipient}
								className={`w-full flex items-center gap-3 p-3 text-left rounded-lg transition-all border ${
									selectedFieldType === "email" && isMarkingMode
										? "bg-blue-100 border-blue-500"
										: hasSenderSigned() && selectedRecipient
										? "hover:bg-blue-50 hover:border-blue-200 border-transparent"
										: "opacity-50 cursor-not-allowed border-transparent"
								}`}
							>
								<span className="text-2xl">✉️</span>
								<div>
									<div className="text-sm font-medium text-gray-800">Email</div>
								</div>
							</button>

							<button
								onClick={() => handleFieldTypeSelect("date")}
								disabled={!hasSenderSigned() || !selectedRecipient}
								className={`w-full flex items-center gap-3 p-3 text-left rounded-lg transition-all border ${
									selectedFieldType === "date" && isMarkingMode
										? "bg-blue-100 border-blue-500"
										: hasSenderSigned() && selectedRecipient
										? "hover:bg-blue-50 hover:border-blue-200 border-transparent"
										: "opacity-50 cursor-not-allowed border-transparent"
								}`}
							>
								<span className="text-2xl">📅</span>
								<div>
									<div className="text-sm font-medium text-gray-800">Date</div>
								</div>
							</button>

							<button
								onClick={() => handleFieldTypeSelect("text")}
								disabled={!hasSenderSigned() || !selectedRecipient}
								className={`w-full flex items-center gap-3 p-3 text-left rounded-lg transition-all border ${
									selectedFieldType === "text" && isMarkingMode
										? "bg-blue-100 border-blue-500"
										: hasSenderSigned() && selectedRecipient
										? "hover:bg-blue-50 hover:border-blue-200 border-transparent"
										: "opacity-50 cursor-not-allowed border-transparent"
								}`}
							>
								<span className="text-2xl">🅰️</span>
								<div>
									<div className="text-sm font-medium text-gray-800">Text</div>
								</div>
							</button>
						</div>
					</div>
				</div>

				{/* Center - Document Viewer */}
				<div className="flex-1 flex flex-col bg-gray-100 overflow-hidden">
					<MultiPageTemplateViewer
						template={selectedTemplate}
						editable={true}
						activeSignatureField={activeSignatureField}
						setActiveSignatureField={setActiveSignatureField}
						showMarkPlaceDialog={showMarkPlaceDialog}
						setShowMarkPlaceDialog={setShowMarkPlaceDialog}
						isMarkingMode={isMarkingMode}
						setIsMarkingMode={setIsMarkingMode}
						selectedFieldType={selectedFieldType}
						setSelectedFieldType={setSelectedFieldType}
						selectedRecipient={selectedRecipient}
						setSelectedRecipient={setSelectedRecipient}
						currentPage={currentPage}
						setCurrentPage={setCurrentPage}
						onFieldAdd={async (pageNumber: number, newField: Omit<SignatureField, "id">) => {
							const id = `${Date.now()}-${Math.random()}`;
							const fieldWithId = { ...newField, id };

							setSelectedTemplate((prev) => {
								if (!prev) return prev;
								return {
									...prev,
									signatureFields: [...(prev.signatureFields || []), fieldWithId],
								};
							});

							if (newField.placeholder && selectedTemplate) {
								try {
									const updatedFields = [...(selectedTemplate.signatureFields || []), fieldWithId];
									await apiClient.put(`/docusign/${selectedTemplate._id}/fields`, {
										fields: updatedFields,
									});
								} catch (error) {
									console.error("Failed to save placeholder field:", error);
								}
							}
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

				{/* Right Sidebar - Document Pages */}
				<div className="w-56 bg-white border-l border-gray-200 flex flex-col overflow-hidden">
					{/* Document Info */}
					<div className="p-3 border-b border-gray-200">
						<h3 className="text-xs font-semibold text-gray-700 mb-1 truncate">
							{selectedTemplate.metadata?.filename || selectedTemplate.name}
						</h3>
						<p className="text-xs text-gray-500">
							{selectedTemplate.numPages} {selectedTemplate.numPages === 1 ? "page" : "pages"},{" "}
							{selectedTemplate.signatureFields?.length || 0}{" "}
							{selectedTemplate.signatureFields?.length === 1 ? "field" : "fields"}
						</p>
					</div>

					{/* Thumbnails */}
					<div className="flex-1 overflow-y-auto p-3">
						<div className="space-y-2">
							{Array.from({ length: selectedTemplate.numPages }, (_, i) => i + 1).map((pageNum) => (
								<PDFThumbnail
									key={pageNum}
									pdfUrl={selectedTemplate.pdfUrl}
									pageNumber={pageNum}
									isActive={currentPage === pageNum}
									onClick={() => setCurrentPage(pageNum)}
								/>
							))}
						</div>
					</div>

					{/* Action Buttons */}
					<div className="border-t border-gray-200 p-3 space-y-2">
						<details className="group">
							<summary className="cursor-pointer text-xs font-medium text-gray-700 hover:text-gray-900 list-none mb-2">
								<div className="flex items-center justify-between">
									<span>Message</span>
									<span className="text-gray-400 group-open:rotate-180 transition-transform text-xs">
										▼
									</span>
								</div>
							</summary>
							<div className="mt-1">
								<MessageComposer
									subject={messageSubject}
									body={messageBody}
									setSubject={setMessageSubject}
									setBody={setMessageBody}
								/>
							</div>
						</details>

						<FinalizePanel
							template={selectedTemplate}
							recipients={recipients}
							subject={messageSubject}
							body={messageBody}
							onSuccess={(urls) => {
								// Handle success - could redirect or show a success message
								console.log("Document finalized:", urls);
							}}
						/>
					</div>
				</div>
			</div>
		</div>
	);
}
