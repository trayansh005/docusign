"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { DocuSignTemplateData, SignatureField } from "@/types/docusign";
import apiClient from "@/lib/apiClient";
import { useAuthStore } from "@/stores/authStore";
import { checkSigningEligibility } from "@/services/docusignAPI";

// Dynamically import RecipientDocumentViewer - simpler component for recipients
const RecipientDocumentViewer = dynamic(
	() =>
		import("@/components/docusign/RecipientDocumentViewer").then((mod) => ({
			default: mod.RecipientDocumentViewer,
		})),

	{
		ssr: false,
		loading: () => (
			<div className="flex items-center justify-center p-8 min-h-[600px]">
				<div className="text-gray-400">Loading PDF viewer...</div>
			</div>
		),
	}
);

export default function SignDocumentClient() {
	const params = useParams();
	const router = useRouter();
	const user = useAuthStore((state) => state.user);
	const templateId = params.templateId as string;

	const [template, setTemplate] = useState<DocuSignTemplateData | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [isSaving, setIsSaving] = useState(false);
	const [showSuccess, setShowSuccess] = useState(false);
	const [canSign, setCanSign] = useState(true);
	const [signingMessage, setSigningMessage] = useState<string>("");
	const [limitError, setLimitError] = useState<string | null>(null);

	useEffect(() => {
		const loadTemplate = async () => {
			if (!templateId) {
				setError("No template ID provided");
				setIsLoading(false);
				return;
			}

			try {
				// Loading template for signing
				const response = await apiClient.get<{ success: boolean; data: DocuSignTemplateData }>(
					`/docusign/${templateId}`
				);

				if (response && response.success && response.data) {
					// Template loaded
					setTemplate(response.data);

					// Check signing eligibility if user is a recipient
					if (user?.email && response.data.recipients && response.data.recipients.length > 0) {
						try {
							const eligibility = await checkSigningEligibility(templateId, user.email);
							setCanSign(eligibility.canSign);
							setSigningMessage(eligibility.message);
						} catch (eligibilityError) {
							console.error("Error checking signing eligibility:", eligibilityError);
							// Don't block signing if eligibility check fails
						}
					}
				} else {
					setError("Failed to load document");
				}
			} catch (err) {
				console.error("Error loading template:", err);
				setError("Error loading document. Please try again.");
			} finally {
				setIsLoading(false);
			}
		};

		loadTemplate();
	}, [templateId]);

	const handleBackToDashboard = () => {
		router.push("/dashboard");
	};

	const handleSaveSignatures = async () => {
		if (!template || !user) return;

		// Check if user can sign based on signing order
		if (!canSign) {
			alert(signingMessage || "It's not your turn to sign yet. Please wait for the previous signer to complete.");
			return;
		}

		const userId = (user as { id?: string })?.id || "";
		// Check if user has filled all their signature fields
		const myFields =
			template.signatureFields?.filter(
				(f) => f.recipientId === user.email || f.recipientId === userId
			) || [];

		// Check if user created at least one signature field
		if (myFields.length === 0) {
			alert("Please click on the document to add at least one signature.");
			return;
		}

		const unfilledFields = myFields.filter((f) => !f.value || f.value.trim() === "");

		if (unfilledFields.length > 0) {
			alert(`Please fill all ${unfilledFields.length} signature field(s) before submitting.`);
			return;
		}

		setIsSaving(true);
		try {
			// Build signature payload using percentage-based coordinates from the viewer
			// Backend will map percentages directly to PDF page size

			// Include all field types (signature, initial, text, address, email, phone, name, date)
			const signatures = myFields
				.map((field: SignatureField) => ({
					pageNumber: field.pageNumber || 1,
					xPct: field.xPct as number,
					yPct: field.yPct as number,
					wPct: field.wPct as number,
					hPct: field.hPct as number,
					signatureImageBuffer: field.value || "",
					recipientId: field.recipientId || user.email || userId,
					type: field.type || "signature",
					fieldId: field.id,
				}));

			// Debug logging to see what's being sent
			console.log("Signatures being sent to backend:", signatures.map(sig => ({
				fieldId: sig.fieldId,
				type: sig.type,
				hasImageData: sig.signatureImageBuffer.startsWith("data:image"),
				valuePreview: sig.signatureImageBuffer.substring(0, 50) + "..."
			})));



			// Sending signatures to API

			// Save the signatures to the backend (RSSC format)
			interface SignResponse {
				success: boolean;
				data: unknown;
			}
			const response = await apiClient.post<SignResponse>(`/docusign/${templateId}/sign`, {
				signatures, // Send as "signatures" (RSSC format), not "signatureFields"
			});

			console.log("[SignDocumentClient] Full API response:", response);
			console.log("[SignDocumentClient] Response success:", response?.success);
			console.log("[SignDocumentClient] Response data:", response?.data);

			if (response && response.success) {
				console.log("[SignDocumentClient] Signature response:", response);

				// Update template with the signed PDF data if available
				if (response.data && typeof response.data === 'object' && 'template' in response.data) {
					const updatedTemplate = (response.data as any).template;
					console.log("[SignDocumentClient] Updating template with signed PDF:", updatedTemplate.finalPdfUrl);
					setTemplate(updatedTemplate);
				}

				setShowSuccess(true);
				// Auto-close modal and navigate back after a longer delay to show the signed document
				setTimeout(() => {
					setShowSuccess(false);
					router.push("/dashboard");
				}, 3000); // Increased delay to 3 seconds
			} else {
				alert("Failed to save signatures. Please try again.");
			}
		} catch (err) {
			console.error("Error saving signatures:", err);
			const message = (err as { message?: string })?.message || "Error saving signatures.";
			if (/FREE_SIGN_LIMIT_REACHED|Free plan signing limit/i.test(String(message))) {
				setLimitError(
					"Free plan signing limit reached. Please upgrade your plan to sign more documents."
				);
			} else {
				alert("Error saving signatures. Please try again.");
			}
		} finally {
			setIsSaving(false);
		}
	};

	if (isLoading) {
		return (
			<div className="min-h-screen bg-[#0a0118] flex items-center justify-center">
				<div className="text-center">
					<div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-400 mx-auto mb-4"></div>
					<p className="text-white text-lg">Loading document...</p>
				</div>
			</div>
		);
	}

	if (error || !template) {
		return (
			<div className="min-h-screen bg-gray-50 flex items-center justify-center">
				<div className="text-center max-w-md mx-auto p-6 bg-white rounded-lg shadow">
					<div className="text-red-600 text-xl mb-4">⚠️ {error || "Document not found"}</div>
					<button
						onClick={handleBackToDashboard}
						className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
					>
						Back to Dashboard
					</button>
				</div>
			</div>
		);
	}

	// Get my signature fields (fields assigned to me or placeholders for recipients)
	const userId = (user as { id?: string })?.id || "";
	const myFields =
		template.signatureFields?.filter(
			(f) => {
				if (!user) return false;
				// Include fields assigned to this user
				if (f.recipientId === user.email || f.recipientId === userId) return true;
				// Include placeholder fields (for recipients to fill)
				if (f.placeholder && f.recipientId === "placeholder") return true;
				return false;
			}
		) || [];

	const filledFields = myFields.filter((f) => f.value && f.value.trim() !== "");
	const progress = myFields.length > 0 ? (filledFields.length / myFields.length) * 100 : 0;

	// Debug logging
	console.log("[SignDocumentClient] Field status:", {
		totalFields: template.signatureFields?.length || 0,
		myFields: myFields.length,
		filledFields: filledFields.length,
		progress,
		fields: myFields.map((f) => ({
			id: f.id,
			hasValue: !!f.value,
			valueLength: f.value?.length || 0,
		})),
	});



	return (
		<div className="min-h-screen bg-gray-50">
			{/* Success Modal */}
			{showSuccess && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
					<div className="bg-white rounded-xl shadow-2xl p-6 w-[90%] max-w-md text-center">
						<div className="mx-auto mb-3 h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
							<svg
								className="h-7 w-7 text-green-600"
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
							>
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									strokeWidth={2}
									d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
								/>
							</svg>
						</div>
						<h3 className="text-lg font-semibold text-gray-900">Document signed successfully</h3>
						<p className="text-gray-600 mt-1">Redirecting you to your dashboard…</p>
						<div className="mt-4">
							<button
								onClick={() => {
									setShowSuccess(false);
									router.push("/dashboard");
								}}
								className="px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white"
							>
								Go to Dashboard
							</button>
						</div>
					</div>
				</div>
			)}
			{limitError && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
					<div className="bg-white rounded-xl shadow-2xl p-6 w-[90%] max-w-md text-center">
						<div className="mx-auto mb-3 h-12 w-12 rounded-full bg-yellow-100 flex items-center justify-center">
							<svg
								className="h-7 w-7 text-yellow-600"
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
							>
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									strokeWidth={2}
									d="M12 9v2m0 4h.01M4.93 4.93l14.14 14.14M12 2a10 10 0 100 20 10 10 0 000-20z"
								/>
							</svg>
						</div>
						<h3 className="text-lg font-semibold text-gray-900">Upgrade required</h3>
						<p className="text-gray-600 mt-1">{limitError}</p>
						<div className="mt-4 flex items-center justify-center gap-3">
							<button
								onClick={() => setLimitError(null)}
								className="px-4 py-2 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-800"
							>
								Close
							</button>
							<a
								href="/subscription"
								className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white"
							>
								See plans
							</a>
						</div>
					</div>
				</div>
			)}
			{/* Header */}
			<div className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
				<div className="max-w-7xl mx-auto px-4 py-4">
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-4">
							<button
								onClick={handleBackToDashboard}
								className="text-gray-600 hover:text-gray-900 transition-colors"
								title="Back to Dashboard"
							>
								<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={2}
										d="M15 19l-7-7 7-7"
									/>
								</svg>
							</button>
							<div>
								<h4 className="text-xl font-semibold text-gray-900">
									{template.metadata?.filename || template.name || "Document"}
								</h4>
								<p className="text-sm text-gray-600">
									Click anywhere on the document to add your signature
								</p>
							</div>
						</div>

					</div>
				</div>
			</div>

			{/* Signing Order Message */}
			{!canSign && signingMessage && (
				<div className="max-w-7xl mx-auto px-4 py-4">
					<div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
						<div className="flex items-center gap-3">
							<div className="flex-shrink-0">
								<svg className="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
								</svg>
							</div>
							<div>
								<h3 className="text-sm font-medium text-yellow-800">Waiting for your turn</h3>
								<p className="text-sm text-yellow-700 mt-1">{signingMessage}</p>
							</div>
						</div>
					</div>
				</div>
			)}

			{/* Document Viewer */}
			<div className="max-w-7xl mx-auto px-4 py-6 pb-24">
				<div className="bg-white rounded-lg shadow-lg overflow-hidden">
					{template && (
						<RecipientDocumentViewer
							template={template}
							onFieldUpdate={(
								pageNumber: number,
								fieldId: string,
								patch: Partial<SignatureField>
							) => {
								console.log("[SignDocumentClient] Field update:", { pageNumber, fieldId, patch });
								setTemplate((prev) => {
									if (!prev) return prev;
									const updatedFields = (prev.signatureFields || []).map((f) =>
										f.id === fieldId ? { ...f, ...patch } : f
									);
									console.log("[SignDocumentClient] Updated fields:", updatedFields);
									return {
										...prev,
										signatureFields: updatedFields,
									};
								});
							}}
						/>
					)}
				</div>
			</div>

			{/* Floating Action Button - Always visible */}
			{myFields.length > 0 && (
				<div className="fixed bottom-8 right-8 z-50 flex flex-col items-end gap-4">
					{/* Progress Card */}
					<div className="bg-white rounded-lg shadow-xl p-4 border border-gray-200">
						<div className="flex items-center gap-3 mb-2">
							<div className="text-sm">
								<p className="font-semibold text-gray-900">
									{filledFields.length} of {myFields.length} fields signed
								</p>
								<div className="w-48 h-2 bg-gray-200 rounded-full mt-1">
									<div
										className="h-2 bg-green-500 rounded-full transition-all duration-300"
										style={{ width: `${progress}%` }}
									/>
								</div>
							</div>
						</div>
					</div>

					{/* Complete Button */}
					<button
						onClick={handleSaveSignatures}
						disabled={isSaving || filledFields.length !== myFields.length}
						className={`px-8 py-4 rounded-lg font-bold text-lg shadow-2xl transition-all transform hover:scale-105 ${isSaving || filledFields.length !== myFields.length
							? "bg-gray-400 text-gray-600 cursor-not-allowed"
							: "bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white"
							}`}
					>
						{isSaving ? (
							<span className="flex items-center gap-2">
								<svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
									<circle
										className="opacity-25"
										cx="12"
										cy="12"
										r="10"
										stroke="currentColor"
										strokeWidth="4"
										fill="none"
									/>
									<path
										className="opacity-75"
										fill="currentColor"
										d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
									/>
								</svg>
								Submitting...
							</span>
						) : (
							<span className="flex items-center gap-2">
								<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={2}
										d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
									/>
								</svg>
								Complete Signing
							</span>
						)}
					</button>
				</div>
			)}
		</div>
	);
}
