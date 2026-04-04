"use client";

import React, { useState, useRef, useCallback, forwardRef, useImperativeHandle } from "react";
import { PenTool } from "lucide-react";
import { ensureAbsoluteUrl } from "@/lib/urlUtils";
import { DocuSignTemplateData, SignatureField } from "@/types/docusign";
import { SIGNATURE_FONTS } from "@/constants/signatureFonts";
import { useAuthStore } from "@/stores/authStore";
import { SignaturePad } from "./SignaturePad";
import { PDFPageCanvas } from "./PDFPageCanvas";

interface RecipientDocumentViewerProps {
	template: DocuSignTemplateData;
	onFieldUpdate?: (pageNumber: number, fieldId: string, patch: Partial<SignatureField>) => void;
}

export interface RecipientDocumentViewerRef {
	applyPendingSignatures: () => void;
	getPendingSignatures: () => Record<
		string,
		{ value: string; fontId?: string; text?: string; imageData?: string }
	>;
}

const RecipientDocumentViewer = forwardRef<
	RecipientDocumentViewerRef,
	RecipientDocumentViewerProps
>(({ template, onFieldUpdate }, ref) => {
	const user = useAuthStore((state) => state.user);
	const [currentPage] = useState(1);
	const [activeSignatureField, setActiveSignatureField] = useState<SignatureField | null>(null);
	const [zoom] = useState(1);
	const [rotation] = useState(0);
	// Use ref instead of state to persist across re-renders
	const pendingSignaturesRef = useRef<
		Record<string, { value: string; fontId?: string; text?: string; imageData?: string }>
	>({});
	const [, forceUpdate] = useState({});
	const contentRef = useRef<HTMLDivElement>(null);
	const userId = (user as { id?: string })?.id || "";
	const userEmail = user?.email || "";
	const recipientFullName = user ? `${user.firstName || ""} ${user.lastName || ""}`.trim() : "";

	// PDF controls will be defined later in the component

	// Get fields that this recipient can fill

	const myFields =
		template.signatureFields?.filter((field) => {
			// Include fields assigned to this user
			if (field.recipientId === userEmail || field.recipientId === userId) return true;
			// Include placeholder fields that recipients can fill
			if (field.placeholder && field.recipientId === "placeholder") return true;
			return false;
		}) || [];

	// Debug field loading
	console.log("RecipientDocumentViewer - Fields debug:", {
		totalFields: template.signatureFields?.length || 0,
		myFields: myFields.length,
		allFields: template.signatureFields,
		userEmail,
		userId,
		sampleFieldPositions: myFields.slice(0, 3).map((f) => ({
			id: f.id,
			xPct: f.xPct,
			yPct: f.yPct,
			wPct: f.wPct,
			hPct: f.hPct,
			placeholder: f.placeholder,
		})),
	});

	// Get fields for current page
	const currentPageFields = myFields.filter((field) => field.pageNumber === currentPage);

	// Handle field click to open signature pad
	const handleFieldClick = useCallback((field: SignatureField) => {
		setActiveSignatureField(field);
	}, []);

	// Handle signature completion - updates both pending state and parent state
	const handleSignatureComplete = useCallback(
		(fieldId: string, signatureData: string, meta?: { fontId?: string; text?: string }) => {
			// For typed signatures, store the TEXT (not image) until final submission
			// For drawn signatures, store the image immediately
			const isTypedSignature = meta?.text && meta?.fontId;

			const pendingData = {
				value: isTypedSignature ? meta.text || "" : signatureData, // Store text for typed, image for drawn
				fontId: meta?.fontId,
				text: meta?.text,
				imageData: signatureData, // Keep image data for later conversion
			};

			console.log(`[RecipientDocumentViewer] Storing pending signature for ${fieldId}:`, {
				isTypedSignature,
				hasText: !!meta?.text,
				hasFontId: !!meta?.fontId,
				hasImageData: !!signatureData,
				imageDataPreview: signatureData?.substring(0, 50),
			});

			// Store in ref (persists across re-renders)
			pendingSignaturesRef.current[fieldId] = pendingData;
			forceUpdate({}); // Trigger re-render to show updated signature

			// Find the field to get its page number
			const field = template.signatureFields.find((f) => f.id === fieldId);
			if (field && onFieldUpdate) {
				const patch: Partial<SignatureField> = {
					value: isTypedSignature ? meta.text : signatureData, // Store text for typed, image for drawn
					fontId: meta?.fontId,
				};

				// If this was a placeholder field, update recipient info
				if (field.placeholder && field.recipientId === "placeholder") {
					onFieldUpdate(field.pageNumber || currentPage, fieldId, {
						...patch,
						recipientId: userEmail || userId || "current-user",
						placeholder: false,
						placeholderText: undefined,
					});
				} else {
					onFieldUpdate(field.pageNumber || currentPage, fieldId, patch);
				}
			}

			setActiveSignatureField(null);
		},
		[onFieldUpdate, template.signatureFields, currentPage, userEmail, userId]
	);

	// Apply pending signatures to the template (convert text to images before submitting)
	const applyPendingSignatures = useCallback(() => {
		if (!onFieldUpdate) return;

		Object.entries(pendingSignaturesRef.current).forEach(([fieldId, sigData]) => {
			const field = template.signatureFields.find((f) => f.id === fieldId);
			if (!field) return;

			// Use the pre-generated image data if available (for typed signatures)
			// Otherwise use the value as-is (for drawn signatures)
			const finalValue = sigData.imageData || sigData.value;

			const patch: Partial<SignatureField> = { value: finalValue };
			if (sigData.fontId) patch.fontId = sigData.fontId;

			if (field.placeholder && field.recipientId === "placeholder") {
				onFieldUpdate(field.pageNumber || currentPage, fieldId, {
					...patch,
					recipientId: userEmail || userId || "current-user",
					placeholder: false,
					placeholderText: undefined,
				});
			} else {
				onFieldUpdate(field.pageNumber || currentPage, fieldId, patch);
			}
		});

		// Clear pending signatures after applying
		pendingSignaturesRef.current = {};
		forceUpdate({});
	}, [onFieldUpdate, template.signatureFields, userEmail, userId, currentPage, forceUpdate]);

	// Expose methods via ref
	useImperativeHandle(ref, () => ({
		applyPendingSignatures,
		getPendingSignatures: () => {
			console.log(
				"[RecipientDocumentViewer] getPendingSignatures called, count:",
				Object.keys(pendingSignaturesRef.current).length
			);
			Object.entries(pendingSignaturesRef.current).forEach(([id, data]) => {
				console.log(`  Field ${id}:`, {
					hasValue: !!data.value,
					hasImageData: !!data.imageData,
					hasText: !!data.text,
					hasFontId: !!data.fontId,
				});
			});
			return pendingSignaturesRef.current;
		},
	}));

	// Render a single field
	const renderField = (field: SignatureField) => {
		// Check for pending signature first (from ref)
		const pendingSignature = pendingSignaturesRef.current[field.id];
		const displayValue = pendingSignature?.value || field.value;
		const hasSigned =
			(displayValue && displayValue.trim() !== "") ||
			(field.value && field.value.trim() !== "") ||
			(pendingSignature && pendingSignature.value && pendingSignature.value.trim() !== "");
		const isPlaceholder = field.placeholder && !pendingSignature && !hasSigned;

		// Field styling
		let fieldColor;
		if (isPlaceholder) {
			fieldColor = "border-orange-400 bg-orange-50"; // Orange for placeholders
		} else if (hasSigned) {
			fieldColor = "border-green-500 bg-green-50"; // Green for completed
		} else {
			fieldColor = "border-blue-400 bg-blue-50"; // Blue for regular fields
		}

		// Get display text
		const getDisplayText = () => {
			// Check for pending signature text first (for typed signatures)
			if (pendingSignature?.text) {
				return pendingSignature.text;
			}

			// If field has a value, display it
			if (displayValue && displayValue.trim() !== "") {
				return displayValue;
			}

			// Handle placeholders
			if (field.placeholder) {
				return field.placeholderText || `[${field.type.toUpperCase()}]`;
			}

			// Default display text based on field type
			switch (field.type) {
				case "signature":
					return "Your Signature";
				case "initial":
					return "YI";
				case "date":
					return new Date().toLocaleDateString();
				case "text":
				case "name":
				case "email":
				case "phone":
				case "address":
					return `Click to fill`;
				default:
					return "Click to fill";
			}
		};

		// Get font family for typed signatures
		const getFontFamily = () => {
			const fontId = pendingSignature?.fontId || field.fontId;
			if (!fontId) return "cursive";

			const font = SIGNATURE_FONTS.find((f) => f.id === fontId);
			return font ? font.fontFamily : "cursive";
		};

		// Convert decimal values (0-1) to percentage values (0-100) if needed
		const xPercent = (field.xPct || 0) <= 1 ? (field.xPct || 0) * 100 : field.xPct || 0;
		const yPercent = (field.yPct || 0) <= 1 ? (field.yPct || 0) * 100 : field.yPct || 0;
		const wPercent = (field.wPct || 0) <= 1 ? (field.wPct || 0) * 100 : field.wPct || 25;
		const hPercent = (field.hPct || 0) <= 1 ? (field.hPct || 0) * 100 : field.hPct || 8;

		console.log(`Field ${field.id} positioning:`, {
			original: { xPct: field.xPct, yPct: field.yPct, wPct: field.wPct, hPct: field.hPct },
			converted: { xPercent, yPercent, wPercent, hPercent },
		});

		return (
			<div
				key={field.id}
				className={`absolute cursor-pointer signature-field border-2 border-dashed ${fieldColor} backdrop-blur-sm rounded-lg 
            flex items-center justify-center hover:shadow-xl transition-all duration-300 ease-out hover:scale-105 shadow-lg`}
				style={{
					left: `${xPercent}%`,
					top: `${yPercent}%`,
					width: `${wPercent}%`,
					height: `${hPercent}%`,
					zIndex: 10,
				}}
				onClick={() => handleFieldClick(field)}
			>
				<div className="flex flex-col items-center justify-center p-2 text-center min-w-0 w-full h-full">
					{(() => {
						// Check if this is a drawn signature (image data that's not typed)
						const value = pendingSignature?.value || field.value;
						const isImage = value && value.startsWith("data:image");
						const isTypedSignature = pendingSignature?.text || (field.fontId && !isImage);

						// Show image only for drawn signatures (not typed)
						if (
							isImage &&
							!isTypedSignature &&
							(field.type === "signature" || field.type === "initial")
						) {
							return (
								<img
									src={value}
									alt={`${field.type} field`}
									style={{
										maxWidth: "100%",
										maxHeight: "100%",
										objectFit: "contain",
										display: "block",
										margin: "0 auto",
									}}
								/>
							);
						}

						// Show text with font styling for typed signatures or placeholders
						return (
							<span
								className={`font-semibold truncate max-w-full ${
									field.placeholder ? "text-gray-600" : "text-gray-800"
								}`}
								style={{
									fontFamily: isTypedSignature ? getFontFamily() : "inherit",
									fontSize: isTypedSignature ? "clamp(12px, 3vw, 24px)" : "14px",
									lineHeight: "1.2",
									fontWeight: isTypedSignature ? "400" : "500",
									letterSpacing: isTypedSignature ? "0.5px" : "normal",
								}}
							>
								{getDisplayText()}
							</span>
						);
					})()}
				</div>

				{/* Sign button for signature/initial fields */}
				{(field.type === "signature" || field.type === "initial") && (
					<button
						type="button"
						className="absolute w-8 h-8 rounded-full bg-green-600 text-white shadow-xl transition-all duration-200 flex items-center justify-center hover:bg-green-700 hover:scale-110 pointer-events-auto cursor-pointer border-2 border-white"
						style={{
							left: `calc(100% + 8px)`,
							top: `-12px`,
							zIndex: 50,
						}}
						onClick={(e) => {
							e.stopPropagation();
							handleFieldClick(field);
						}}
						title="Click to sign this field"
					>
						<PenTool className="w-3.5 h-3.5" />
					</button>
				)}
			</div>
		);
	};

	return (
		<div className="flex flex-col h-full">
			{/* Document content */}
			<div
				className="flex-1 overflow-auto relative bg-gray-100 flex items-start justify-center"
				ref={contentRef}
				style={{
					minHeight: "600px",
					padding: "20px",
				}}
			>
				<div className="relative" style={{ maxWidth: "850px", width: "100%" }}>
					<div
						className="relative w-full"
						style={{
							transform: `scale(${zoom}) rotate(${rotation}deg)`,
							transformOrigin: "center top",
							transition: "transform 0.2s ease-in-out",
						}}
					>
						<PDFPageCanvas
							pdfUrl={ensureAbsoluteUrl(
								template.finalPdfUrl || template.pdfUrl || template.metadata?.originalPdfPath || ""
							)}
							pageNumber={currentPage}
							zoom={1} // Apply zoom via parent transform for consistent overlay sizing
							rotation={0} // Apply rotation via parent transform
							onPageLoad={() => {}}
							className="w-full"
						/>

						{/* Fields overlay */}
						{currentPageFields.map(renderField)}
					</div>
				</div>
			</div>

			{/* Signature Pad Modal */}
			{activeSignatureField && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
					<SignaturePad
						field={activeSignatureField}
						onClose={() => setActiveSignatureField(null)}
						onSignatureComplete={handleSignatureComplete}
						recipientName={recipientFullName}
						recipientEmail={userEmail}
					/>
				</div>
			)}
		</div>
	);
});

RecipientDocumentViewer.displayName = "RecipientDocumentViewer";

export default RecipientDocumentViewer;
