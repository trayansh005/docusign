"use client";

import { useState } from "react";
import { CheckCircle } from "lucide-react";
import { DocuSignTemplateData } from "@/types/docusign";
import { useAuthStore } from "@/stores/authStore";
import apiClient from "@/lib/apiClient";
import { Recipient } from "./types";

interface FinalizePanelProps {
	template: DocuSignTemplateData;
	recipients: Recipient[];
	subject: string;
	body: string;
	onSuccess?: (urls: string[]) => void;
}

export function FinalizePanel({
	template,
	recipients,
	subject,
	body,
	onSuccess,
}: FinalizePanelProps) {
	const [loading, setLoading] = useState(false);
	const [resultUrls, setResultUrls] = useState<string[] | null>(null);
	const [limitError, setLimitError] = useState<string | null>(null);

	// Get logged-in user for signature text
	const user = useAuthStore((state) => state.user);
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
		setLimitError(null);
		try {
			// Get sender's signature fields and placeholder fields
			const senderSignatureFields = template.signatureFields.filter((field) =>
				!field.placeholder && // Exclude placeholder fields
				(field.type === "signature" || field.type === "initial") && // Only signature/initial fields
				(field.recipientId === user?.email || field.recipientId?.includes("current-user") || !field.recipientId)
			);

			const placeholderFields = template.signatureFields.filter(field => field.placeholder);
			const hasPlaceholders = placeholderFields.length > 0;
			const hasRecipients = recipients && recipients.length > 0;

			// Validation 1: If there are placeholder fields, recipients must be selected
			if (hasPlaceholders && !hasRecipients) {
				setLimitError("You have marked places for recipients to sign, but no recipients are selected. Please add recipients or remove the marked places.");
				setLoading(false);
				return;
			}

			// Validation 2: If no placeholders and no recipients, sender must have signed
			if (!hasPlaceholders && !hasRecipients) {
				// For now, if sender signature fields exist, assume they're signed
				// TODO: Fix the signature value saving issue
				if (senderSignatureFields.length === 0) {
					setLimitError("You must sign the document first. Please click the green pen icon to add your signature, or add recipients if you want them to sign.");
					setLoading(false);
					return;
				}
			}

			// Validation 3: If sending to recipients, sender must sign first (mandatory)
			if (hasRecipients) {
				// For now, if sender signature fields exist, assume they're signed
				// TODO: Fix the signature value saving issue
				if (senderSignatureFields.length === 0) {
					setLimitError("You must sign the document before sending it to recipients. Please click the green pen icon to add your signature.");
					setLoading(false);
					return;
				}
			}

			// Try to fetch user's saved signatures and prefer the default one if present.
			let defaultSignature: { _id?: string; isDefault?: boolean } | null = null;
			try {
				const sigRes = await apiClient.get<{
					success?: boolean;
					data?: Array<{ _id?: string; isDefault?: boolean }>;
				}>(`/signatures`);
				if (sigRes && sigRes.success && Array.isArray(sigRes.data)) {
					const list = sigRes.data;
					defaultSignature =
						(list.find((s) => s.isDefault) as { _id?: string; isDefault?: boolean }) ||
						(list[0] as { _id?: string; isDefault?: boolean }) ||
						null;
				}
			} catch (e) {
				// ignore - fallback to generating images client-side
				const msg = e instanceof Error ? e.message : String(e);
				console.debug("Could not fetch saved signatures, falling back to generated images", msg);
			}
			// Generate signature images for sender's own fields (not placeholders)
			const senderFields = template.signatureFields.filter((field) =>
				!field.placeholder && // Exclude placeholder fields
				(field.type === "signature" || field.type === "initial") && // Only signature/initial fields
				(field.recipientId === user?.email || field.recipientId?.includes("current-user") || !field.recipientId)
			);

			const signaturePromises = senderFields.map(async (field) => {
				// Check if field has a signature pad value (base64 image data)
				if (field.value && field.value.startsWith('data:image/')) {
					return {
						id: field.id,
						fieldId: field.id,
						recipientId: field.recipientId,
						type: field.type,
						pageNumber: field.pageNumber,
						signatureImageBuffer: field.value, // Use the pad signature directly
						image: field.value,
						index: template.signatureFields.indexOf(field),
					};
				}

				// Use the same logic as the field display for text-based signatures:
				// 1. If field.value exists (but not image data), use it as text
				// 2. Else if initial field, use userInitials
				// 3. Else (signature field), use userFullName
				const text =
					field.value && field.value.length > 0 && !field.value.startsWith('data:image/')
						? field.value
						: field.type === "initial"
							? userInitials
							: userFullName;

				const fontFamily = getFontFamily(field.fontId);
				const width = Math.round((field.wPct / 100) * 800); // Assume 800px viewport width
				const height = Math.round((field.hPct / 100) * 1131); // Assume A4 aspect ratio

				// If user has a saved default signature, prefer sending its id to the backend
				// Backend will resolve the stored file and resize/render it appropriately.
				if (defaultSignature && defaultSignature._id) {
					return {
						id: defaultSignature._id,
						fieldId: field.id,
						recipientId: field.recipientId,
						type: field.type,
						pageNumber: field.pageNumber,
						index: template.signatureFields.indexOf(field),
					};
				}

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

			// Get placeholder fields for recipients
			const recipientPlaceholderFields = template.signatureFields.filter(field => field.placeholder);

			// Use the unified signing endpoint that works for both senders and recipients
			const unifiedPayload = {
				signatures: signatures.map((sig) => ({
					pageNumber: sig.pageNumber || 1,
					xPct: template.signatureFields?.find(f => f.id === sig.fieldId)?.xPct || 0,
					yPct: template.signatureFields?.find(f => f.id === sig.fieldId)?.yPct || 0,
					wPct: template.signatureFields?.find(f => f.id === sig.fieldId)?.wPct || 20,
					hPct: template.signatureFields?.find(f => f.id === sig.fieldId)?.hPct || 5,
					signatureImageBuffer: sig.signatureImageBuffer || sig.image,
					recipientId: sig.recipientId || "current-user",
					type: sig.type || "signature",
					fieldId: sig.fieldId || sig.id,
				})).filter(sig => sig.signatureImageBuffer), // Only include signatures with actual data

				// Include placeholder fields for recipients to fill
				placeholderFields: recipientPlaceholderFields.map(field => ({
					id: field.id,
					type: field.type,
					pageNumber: field.pageNumber,
					xPct: field.xPct,
					yPct: field.yPct,
					wPct: field.wPct,
					hPct: field.hPct,
					placeholderText: field.placeholderText,
					required: field.required || false,
				})),

				// Include recipients and message
				recipients: recipients || [],
				message: { subject: subject || "", body: body || "" },
			};



			const res = await apiClient.post(`/docusign/${template._id}/sign`, unifiedPayload);

			// Detect free sign limit errors coming from the backend (often 403 with { success:false, code, message })
			if (res && typeof res === "object") {
				const r = res as Record<string, unknown>;
				const success = r.success as boolean | undefined;
				const code = (r.code as string | undefined) || "";
				const message = (r.message as string | undefined) || "";
				if (
					(success === false && /FREE_SIGN_LIMIT_REACHED/i.test(code)) ||
					/Free plan signing limit/i.test(message)
				) {
					setLimitError(
						"Free plan signing limit reached. Please upgrade your plan to sign more documents."
					);
					setResultUrls([]);
					return; // Stop normal success handling
				}
			}

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
			};

			// Handle unified sign endpoint response
			if (res && typeof res === "object") {
				const r = res as Record<string, unknown>;
				const data = (r.data as Record<string, unknown>) || {};
				const template = (data.template as Record<string, unknown>) || {};

				// Check for finalPdfUrl in various locations (unified endpoint puts it in template.finalPdfUrl)
				const finalPdfUrl =
					(typeof template.finalPdfUrl === "string" && template.finalPdfUrl) ||
					(typeof data.finalPdfUrl === "string" && data.finalPdfUrl) ||
					(r.finalPdfUrl as string) ||
					"";



				if (typeof finalPdfUrl === "string" && finalPdfUrl.length > 0) {
					const absoluteUrl = toAbsoluteUrl(finalPdfUrl);

					setResultUrls([absoluteUrl]);
					onSuccess?.([absoluteUrl]);
				} else if (Array.isArray(data.signedPages)) {
					// Backend returns signed pages inside data.signedPages (array of { pageNumber, signedImageUrl })
					const urls = (data.signedPages as unknown[])
						.map((p) => {
							if (p && typeof p === "object") {
								const obj = p as Record<string, unknown>;
								// prefer signedImageUrl, then signedImageUrl.url, then url
								const sig = obj.signedImageUrl;
								let sigUrl = "";
								if (typeof sig === "string") sigUrl = sig;
								else if (
									sig &&
									typeof sig === "object" &&
									typeof (sig as Record<string, unknown>).url === "string"
								)
									sigUrl = (sig as Record<string, unknown>).url as string;
								return sigUrl || (obj.url as string) || (obj.imageUrl as string) || "";
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
					// No valid response format found
					console.error("Invalid response format:", res);
					setLimitError("Failed to process the signed document. Please try again or contact support.");
					setLoading(false);
					return;
				}
			} else if (Array.isArray(res)) {
				setResultUrls((res as string[]).map(toAbsoluteUrl));
			} else {
				// Unexpected response format
				console.error("Unexpected response format:", res);
				setLimitError("Received an unexpected response from the server. Please try again.");
				setLoading(false);
				return;
			}
		} catch (err) {
			// show basic error in console for now
			console.error("Failed to generate signed document", err);
			// Try to surface friendly CTA if backend indicated free sign limit
			const message = err instanceof Error ? err.message : String(err);
			if (/FREE_SIGN_LIMIT_REACHED|Free plan signing limit/i.test(String(message))) {
				setLimitError(
					"Free plan signing limit reached. Please upgrade your plan to sign more documents."
				);
			} else {
				setResultUrls([]);
			}
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className="space-y-3">
			{/* Free sign limit modal CTA */}
			{limitError && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
					<div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
						<h3 className="text-lg font-semibold text-gray-900">
							{limitError.includes("must sign") ? "Signature Required" : "Upgrade to continue"}
						</h3>
						<p className="mt-2 text-sm text-gray-700">{limitError}</p>
						<div className="mt-4 flex items-center justify-end gap-3">
							<button
								className="px-4 py-2 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-100"
								onClick={() => setLimitError(null)}
							>
								Close
							</button>
						</div>
					</div>
				</div>
			)}
			<button
				className="w-full px-4 py-3 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white font-semibold"
				onClick={generate}
				disabled={loading}
			>
				{loading
					? "Processing..."
					: recipients.length > 0
						? "Send for Signature"
						: "Sign Document"
				}
			</button>
			<div className="mt-2">
				{resultUrls === null ? null : resultUrls.length === 0 ? (
					<div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-2">
						No signed document was generated. This usually means:
						<ul className="mt-1 ml-4 list-disc text-xs">
							<li>You haven't signed the document yet</li>
							<li>There was an error processing your signature</li>
							<li>The document format is not supported</li>
						</ul>
						Please try signing the document again or contact support.
					</div>
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
								If the preview doesn&apos;t render, click &quot;Open Final PDF&quot; to view in a
								new tab.
							</p>
						</div>
					</div>
				)}
			</div>
		</div>
	);
}
