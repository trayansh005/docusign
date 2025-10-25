"use client";

import React, { useState, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import {
	ChevronLeft,
	ChevronRight,
	ZoomIn,
	ZoomOut,
	RotateCw,
	Trash2,
	Palette,
	PenTool,
	MapPin,
	X,
} from "lucide-react";
import { DndContext, useDraggable, DragEndEvent } from "@dnd-kit/core";
import { ensureAbsoluteUrl } from "@/lib/urlUtils";
import { DocuSignTemplateData, SignatureField } from "@/types/docusign";
import { useAuthStore } from "@/stores/authStore";
import { SignaturePad } from "./SignaturePad";
import { SigningProgress } from "./SigningProgress";

// Available field types for Mark Place
const FIELD_TYPES = [
	{ id: "signature", label: "Signature", icon: "✍️", description: "Recipient's signature" },
	{ id: "initial", label: "Initial", icon: "📝", description: "Recipient's initials" },
	{ id: "name", label: "Full Name", icon: "👤", description: "Recipient's full name" },
	{ id: "email", label: "Email", icon: "📧", description: "Email address" },
	{ id: "phone", label: "Phone", icon: "📱", description: "Phone number" },
	{ id: "address", label: "Address", icon: "🏠", description: "Full address" },
	{ id: "date", label: "Date", icon: "📅", description: "Current date" },
	{ id: "text", label: "Custom Text", icon: "📄", description: "Any custom text" },
];

// Available signature fonts
const SIGNATURE_FONTS = [
	{
		id: "dancing-script",
		name: "Dancing Script",
		fontFamily: "var(--font-dancing-script), 'Dancing Script', cursive",
	},
	{
		id: "great-vibes",
		name: "Great Vibes",
		fontFamily: "var(--font-great-vibes), 'Great Vibes', cursive",
	},
	{ id: "allura", name: "Allura", fontFamily: "var(--font-allura), 'Allura', cursive" },
	{
		id: "alex-brush",
		name: "Alex Brush",
		fontFamily: "var(--font-alex-brush), 'Alex Brush', cursive",
	},
	{ id: "amatic-sc", name: "Amatic SC", fontFamily: "var(--font-amatic-sc), 'Amatic SC', cursive" },
	{ id: "caveat", name: "Caveat", fontFamily: "var(--font-caveat), 'Caveat', cursive" },
	{
		id: "kaushan-script",
		name: "Kaushan Script",
		fontFamily: "var(--font-kaushan-script), 'Kaushan Script', cursive",
	},
	{ id: "pacifico", name: "Pacifico", fontFamily: "var(--font-pacifico), 'Pacifico', cursive" },
	{ id: "satisfy", name: "Satisfy", fontFamily: "var(--font-satisfy), 'Satisfy', cursive" },
	{
		id: "permanent-marker",
		name: "Permanent Marker",
		fontFamily: "var(--font-permanent-marker), 'Permanent Marker', cursive",
	},
];

// Dynamically import PDFPageCanvas to avoid SSR issues with DOMMatrix
const PDFPageCanvas = dynamic(
	() => import("./PDFPageCanvas").then((mod) => ({ default: mod.PDFPageCanvas })),
	{
		ssr: false,
		loading: () => (
			<div className="flex items-center justify-center p-8 min-h-[600px] bg-gray-100">
				<div className="text-gray-600">Loading document viewer...</div>
			</div>
		),
	}
);

// Removed Word document viewer - now using PDF viewer for all documents

interface MultiPageTemplateViewerProps {
	template: DocuSignTemplateData;
	onFieldAdd?: (pageNumber: number, field: Omit<SignatureField, "id">) => void;
	onFieldRemove?: (pageNumber: number, fieldId: string) => void;
	onFieldUpdate?: (pageNumber: number, fieldId: string, patch: Partial<SignatureField>) => void;
	editable?: boolean;
	className?: string;
	activeSignatureField?: SignatureField | null;
	setActiveSignatureField?: (field: SignatureField | null) => void;
	showSigningProgress?: boolean;
}

export const MultiPageTemplateViewer: React.FC<MultiPageTemplateViewerProps> = ({
	template,
	onFieldAdd,
	onFieldRemove,
	onFieldUpdate,
	editable = false,
	className = "",
	activeSignatureField: externalActiveField,
	setActiveSignatureField: externalSetActiveField,
	showSigningProgress = false,
}) => {
	const [currentPage, setCurrentPage] = useState(1);
	const [zoom, setZoom] = useState(1);
	const [rotation, setRotation] = useState(0);
	const contentRef = useRef<HTMLDivElement | null>(null);

	// Use external state if provided, otherwise use internal state
	const [internalActiveField, setInternalActiveField] = useState<SignatureField | null>(null);
	const activeSignatureField =
		externalActiveField !== undefined ? externalActiveField : internalActiveField;
	const setActiveSignatureField = externalSetActiveField || setInternalActiveField;

	// Mark Place dialog state
	const [showMarkPlaceDialog, setShowMarkPlaceDialog] = useState(false);
	const [selectedFieldType, setSelectedFieldType] = useState<string>("signature");
	const [isMarkingMode, setIsMarkingMode] = useState(false);

	// Get logged-in user
	const user = useAuthStore((state) => state.user);

	// Check if sender has signed (required before marking places)
	const hasSenderSigned = useCallback(() => {
		if (!template?.signatureFields) return false;

		// Find signature fields that belong to the current user (not placeholders)
		const userEmail = user?.email;
		const userId = (user as any)?.id;

		const senderFields = template.signatureFields.filter((field) => {
			// Must not be a placeholder
			if (field.placeholder) return false;

			// Must be a signature or initial field
			if (field.type !== "signature" && field.type !== "initial") return false;

			// Check if this field belongs to the current user
			return (
				field.recipientId === userEmail ||
				field.recipientId === userId ||
				field.recipientId === "current-user" ||
				field.recipientId?.includes("current-user") ||
				!field.recipientId
			);
		});

		// For now, if sender fields exist, assume they can mark places
		// TODO: Fix the signature value saving issue
		return senderFields.length > 0;
	}, [template?.signatureFields, user?.email, user]);

	// Get user's full name for signature fields
	const userFullName =
		user?.firstName && user?.lastName ? `${user.firstName} ${user.lastName}` : "Your Signature";

	const userInitials =
		user?.firstName && user?.lastName ? `${user.firstName[0]}${user.lastName[0]}` : "YI";

	// Handle signature field click (for recipients to fill in)
	const handleFieldClick = useCallback(
		(field: SignatureField, e: React.MouseEvent) => {
			e.stopPropagation();
			// Check if this field belongs to the current user
			const userId = (user as { id?: string })?.id || "";
			const userEmail = user?.email || "";



			const isMyField = user && (
				field.recipientId === userEmail ||
				field.recipientId === userId ||
				!field.recipientId || // Handle fields without recipientId (newly created fields)
				field.recipientId === "current-user" || // Handle fields created with fallback recipientId
				field.recipientId?.includes("current-user") // Handle variations
			);

			const isPlaceholder = field.placeholder && field.recipientId === "placeholder";

			// Allow interaction if:
			// 1. It's my field, OR
			// 2. In editable mode (sender), OR  
			// 3. It's a placeholder (recipient can fill any placeholder)
			if (isMyField || editable || isPlaceholder) {
				// Open signature pad for this field
				setActiveSignatureField(field);

				// For placeholders, convert to recipient field when they start filling
				// This will be done when they save their input
			}
		},
		[user, setActiveSignatureField, editable]
	);

	// Handle signature completion from SignaturePad
	const handleSignatureComplete = useCallback(
		(fieldId: string, signatureData: string) => {
			if (onFieldUpdate) {
				const field = template.signatureFields.find(f => f.id === fieldId);
				const userId = (user as { id?: string })?.id || "";
				const userEmail = user?.email || "";

				// If it's a placeholder field, convert it to a regular field assigned to current user
				if (field?.placeholder && field.recipientId === "placeholder") {
					onFieldUpdate(currentPage, fieldId, {
						value: signatureData,
						recipientId: userEmail || userId || "current-user",
						placeholder: false,
						placeholderText: undefined,
					});
				} else {
					onFieldUpdate(currentPage, fieldId, { value: signatureData });
				}
			}
			setActiveSignatureField(null);
		},
		[onFieldUpdate, currentPage, setActiveSignatureField, template.signatureFields, user]
	);

	// Handle font change for signature fields
	const handleFontChange = useCallback(
		(fieldId: string) => {
			if (!editable || !onFieldUpdate) return;

			const field = template.signatureFields.find((f) => f.id === fieldId);
			if (!field || (field.type !== "signature" && field.type !== "initial")) return;

			const currentFontIndex = SIGNATURE_FONTS.findIndex((font) => font.id === field.fontId);
			const nextFontIndex = (currentFontIndex + 1) % SIGNATURE_FONTS.length;
			const nextFontId = SIGNATURE_FONTS[nextFontIndex].id;

			onFieldUpdate(currentPage, fieldId, { fontId: nextFontId });
		},
		[editable, onFieldUpdate, template.signatureFields, currentPage]
	);

	// Handle drag end for dnd-kit
	const handleDragEnd = useCallback(
		(event: DragEndEvent) => {
			const { active, delta } = event;
			const field = active.data.current?.field as SignatureField;

			if (!field || !contentRef.current) return;

			const containerRect = contentRef.current.getBoundingClientRect();

			// Convert pixel delta to percentage delta
			const deltaXPct = (delta.x / containerRect.width) * 100;
			const deltaYPct = (delta.y / containerRect.height) * 100;

			const newXPct = Math.max(0, Math.min(100 - field.wPct, field.xPct + deltaXPct));
			const newYPct = Math.max(0, Math.min(100 - field.hPct, field.yPct + deltaYPct));

			onFieldUpdate?.(currentPage, field.id, { xPct: newXPct, yPct: newYPct });
		},
		[onFieldUpdate, currentPage]
	);

	const currentPageFields = template.signatureFields.filter(
		(field) => field.pageNumber === currentPage
	);

	const handleZoomIn = () => setZoom((prev) => Math.min(prev + 0.25, 3));
	const handleZoomOut = () => setZoom((prev) => Math.max(prev - 0.25, 0.25));
	const handleRotate = () => setRotation((prev) => (prev + 90) % 360);

	// DraggableField component following RCSS pattern
	function DraggableField({ field }: { field: SignatureField }) {
		const [isResizing, setIsResizing] = useState(false);
		const [isDragStarted, setIsDragStarted] = useState(false);

		// Only document owners can drag fields (including their placeholder fields)
		// Recipients cannot drag any fields
		const isDocumentOwner = template && user && template.createdBy === (user as any)?.id;
		const isDraggingDisabled = isResizing || !isDocumentOwner;

		const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
			id: field.id,
			data: { field },
			disabled: isDraggingDisabled,
		});

		// Track drag state to prevent click during drag
		React.useEffect(() => {
			if (isDragging) {
				setIsDragStarted(true);
			} else {
				// Reset drag state after a short delay to allow drag end
				const timer = setTimeout(() => setIsDragStarted(false), 100);
				return () => clearTimeout(timer);
			}
		}, [isDragging]);



		const style: React.CSSProperties = {
			transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
			position: "absolute",
			left: `${field.xPct || 0}%`,
			top: `${field.yPct || 0}%`,
			width: `${field.wPct || 25}%`,
			height: `${field.hPct || 8}%`,
			zIndex: isDragging || isResizing ? 1000 : 10,
			opacity: isDragging ? 0.8 : 1,
		};

		// Change color based on field type and status
		const hasSigned = field.value && field.value.trim() !== "";
		const isPlaceholder = field.placeholder;



		let fieldColor;
		if (isPlaceholder) {
			fieldColor = "border-orange-400 bg-orange-50"; // Orange for placeholders
		} else if (hasSigned) {
			fieldColor = "border-green-500 bg-green-50"; // Green for completed
		} else {
			fieldColor = "border-blue-400 bg-blue-50"; // Blue for regular fields
		}

		const handleResizeStart = (e: React.MouseEvent) => {
			e.stopPropagation();
			setIsResizing(true);

			const rect = contentRef.current?.getBoundingClientRect();
			if (!rect) return;

			const startValues = {
				x: e.clientX,
				y: e.clientY,
				wPct: field.wPct,
				hPct: field.hPct,
			};

			const handleMouseMove = (e: MouseEvent) => {
				const deltaX = e.clientX - startValues.x;
				const deltaY = e.clientY - startValues.y;

				const deltaWPct = (deltaX / rect.width) * 100;
				const deltaHPct = (deltaY / rect.height) * 100;

				const newWPct = Math.max(5, Math.min(100 - field.xPct, startValues.wPct + deltaWPct));
				const newHPct = Math.max(3, Math.min(100 - field.yPct, startValues.hPct + deltaHPct));

				onFieldUpdate?.(currentPage, field.id, { wPct: newWPct, hPct: newHPct });
			};

			const handleMouseUp = () => {
				setIsResizing(false);
				document.removeEventListener("mousemove", handleMouseMove);
				document.removeEventListener("mouseup", handleMouseUp);
			};

			document.addEventListener("mousemove", handleMouseMove);
			document.addEventListener("mouseup", handleMouseUp);
		};

		const getFontFamily = () => {
			if (field.type === "signature" || field.type === "initial") {
				const selectedFont = SIGNATURE_FONTS.find((font) => font.id === field.fontId);
				return selectedFont ? selectedFont.fontFamily : SIGNATURE_FONTS[0].fontFamily;
			}
			return "inherit";
		};

		const getSignatureText = () => {
			// If it's a placeholder, show the placeholder text
			if (field.placeholder) {
				return field.value || field.placeholderText || `[${field.type.toUpperCase()}]`;
			}

			// Regular field display logic
			switch (field.type) {
				case "signature":
					return field.value || userFullName || "Your Signature";
				case "initial":
					return field.value || userInitials || "YI";
				case "date":
					return field.value || new Date().toLocaleDateString();
				case "text":
					return field.value || "Text";
				case "name":
					return field.value || "Full Name";
				case "email":
					return field.value || "Email Address";
				case "phone":
					return field.value || "Phone Number";
				case "address":
					return field.value || "Address";
				default:
					return "Field";
			}
		};

		const getDynamicFontSize = () => {
			const rect = contentRef.current?.getBoundingClientRect();
			if (!rect) return "12px";

			const pixelHeight = (field.hPct / 100) * rect.height;
			let sizeFactor = 12;

			switch (field.type) {
				case "signature":
					sizeFactor = Math.min(Math.max(pixelHeight * 0.35, 8), 24);
					break;
				case "initial":
					sizeFactor = Math.min(Math.max(pixelHeight * 0.45, 8), 20);
					break;
				case "date":
					sizeFactor = Math.min(Math.max(pixelHeight * 0.3, 8), 14);
					break;
				case "text":
					sizeFactor = Math.min(Math.max(pixelHeight * 0.3, 8), 16);
					break;
				default:
					sizeFactor = Math.min(Math.max(pixelHeight * 0.35, 8), 16);
			}

			return `${Math.round(sizeFactor)}px`;
		};

		return (
			<>
				{/* Draggable field element */}
				<div
					ref={setNodeRef}
					style={style}
					{...(!isDraggingDisabled ? listeners : {})}
					{...(!isDraggingDisabled ? attributes : {})}
					onClick={(e) => {
						// Don't handle click if user just finished dragging
						if (isDragStarted) return;

						e.stopPropagation();
						handleFieldClick(field, e);
					}}
					className={`signature-field border-2 border-dashed ${fieldColor} backdrop-blur-sm rounded-lg 
						flex items-center justify-center hover:shadow-xl transition-all duration-300 ease-out
						${isDragging || isResizing
							? "shadow-2xl scale-110 ring-2 ring-blue-400 ring-opacity-50"
							: "shadow-lg hover:scale-105"
						}
						group select-none ${isResizing ? "cursor-se-resize" : field.placeholder ? "cursor-pointer" : editable ? "cursor-move" : "cursor-pointer"}`}
				>
					<div className="flex flex-col items-center justify-center p-3 text-center min-w-0">
						{(field.type === "signature" || field.type === "initial") &&
							field.value &&
							field.value.startsWith("data:image") ? (
							// eslint-disable-next-line @next/next/no-img-element
							<img
								src={field.value}
								alt="signature"
								style={{
									maxWidth: "100%",
									maxHeight: "100%",
									objectFit: "contain",
									display: "block",
									margin: "0 auto",
								}}
							/>
						) : (
							<span
								className={`font-semibold truncate max-w-full ${field.placeholder ? 'text-gray-600' : 'text-gray-800'}`}
								style={{
									fontFamily: getFontFamily(),
									fontSize: (field.type === "text" || field.type === "name" || field.type === "email" || field.type === "phone" || field.type === "address") ? '16px' : getDynamicFontSize(),
									lineHeight: "1.2",
									fontWeight:
										field.type === "signature" || field.type === "initial" ? "400" : "600",
									letterSpacing:
										field.type === "signature" || field.type === "initial" ? "0.5px" : "normal",
								}}
							>
								{getSignatureText()}
							</span>
						)}
					</div>

					{/* Resize handle - bottom right corner */}
					{editable && (
						<div
							onMouseDown={handleResizeStart}
							className="absolute -bottom-1 -right-1 w-4 h-4 bg-blue-600 border-2 border-white rounded-full cursor-se-resize opacity-0 group-hover:opacity-100 transition-all duration-200 hover:bg-blue-700 hover:scale-110 shadow-md"
							style={{ zIndex: 20 }}
							title="Drag to resize"
						>
							{/* Resize icon - small grip lines */}
							<div className="absolute inset-0 flex items-center justify-center">
								<div className="grid grid-cols-2 gap-0.5">
									<div className="w-0.5 h-0.5 bg-white rounded-full"></div>
									<div className="w-0.5 h-0.5 bg-white rounded-full"></div>
									<div className="w-0.5 h-0.5 bg-white rounded-full"></div>
									<div className="w-0.5 h-0.5 bg-white rounded-full"></div>
								</div>
							</div>
						</div>
					)}
				</div>

				{/* Action buttons positioned outside the draggable element */}
				{editable && !field.placeholder && (
					// Check if user is document owner (can delete any field)
					template && user && template.createdBy === (user as any)?.id
				) && (
						<>
							{/* Delete button - only for document owners */}
							<button
								type="button"
								className={`absolute w-7 h-7 rounded-full bg-red-500 text-white shadow-lg transition-all duration-200 flex items-center justify-center z-10 hover:bg-red-600 pointer-events-auto ${isDragging ? "opacity-0" : "opacity-100"
									}`}
								style={{
									left: `calc(${field.xPct || 0}% + ${field.wPct || 25}% - 14px)`,
									top: `calc(${field.yPct || 0}% - 12px)`,
									zIndex: 30,
								}}
								onClick={(e) => {
									e.stopPropagation();
									onFieldRemove?.(currentPage, field.id);
								}}
								title="Delete field"
							>
								<Trash2 className="w-3.5 h-3.5" />
							</button>

							{/* Font selection button */}
							{(field.type === "signature" || field.type === "initial") && (
								<button
									type="button"
									className={`absolute w-7 h-7 rounded-full bg-purple-600 text-white shadow-lg transition-all duration-200 flex items-center justify-center z-10 hover:bg-purple-700 pointer-events-auto ${isDragging ? "opacity-0" : "opacity-100"
										}`}
									style={{
										left: `calc(${field.xPct || 0}% + ${(field.wPct || 25) / 2}% - 24px)`,
										top: `calc(${field.yPct || 0}% - 12px)`,
										zIndex: 30,
									}}
									onClick={(e) => {
										e.stopPropagation();
										handleFontChange(field.id);
									}}
									title={`Change font style (${SIGNATURE_FONTS.find((font) => font.id === field.fontId)?.name ||
										SIGNATURE_FONTS[0].name
										})`}
								>
									<Palette className="w-3.5 h-3.5" />
								</button>
							)}

							{/* Sign/Draw button - Opens signature pad */}
							{(field.type === "signature" || field.type === "initial") && (
								<button
									type="button"
									className={`absolute w-8 h-8 rounded-full bg-green-600 text-white shadow-xl transition-all duration-200 flex items-center justify-center hover:bg-green-700 hover:scale-110 pointer-events-auto cursor-pointer border-2 border-white ${isDragging ? "opacity-0 pointer-events-none" : "opacity-100"
										}`}
									style={{
										left: `calc(${field.xPct || 0}% + ${(field.wPct || 25) / 2}% + 16px)`,
										top: `calc(${field.yPct || 0}% - 16px)`,
										zIndex: 50,
									}}
									onClick={(e) => {
										e.stopPropagation();
										handleFieldClick(field, e);
									}}
									title="Click to sign this field"
								>
									<PenTool className="w-3.5 h-3.5" />
								</button>
							)}
						</>
					)}
			</>
		);
	}

	const handleCanvasClick = useCallback(
		(e: React.MouseEvent<HTMLDivElement>) => {
			if (!editable) return;

			// Only document owners can add new fields by clicking on canvas
			// Recipients should only fill existing placeholder fields
			const isDocumentOwner = template && user && template.createdBy === (user as any)?.id;

			if (!isDocumentOwner) return;

			// Don't add field if clicking on an existing field
			const target = e.target as HTMLElement;
			if (target.closest(".signature-field")) {
				return;
			}

			// Prefer measuring the inner content (which is transformed/scaled). Fallback to currentTarget.
			const targetRect =
				(contentRef.current && contentRef.current.getBoundingClientRect()) ||
				(e.currentTarget && e.currentTarget.getBoundingClientRect());
			const rect = targetRect || { left: 0, top: 0, width: 1, height: 1 };
			const width = rect.width || 1;
			const height = rect.height || 1;
			// Simple percentage system (0-100 range) - consistent everywhere
			const x = ((e.clientX - rect.left) / width) * 100;
			const y = ((e.clientY - rect.top) / height) * 100;

			// Fixed field size for consistency
			const wPct = 25; // 25% of page width
			const hPct = 8;  // 8% of page height



			const userId = (user as { id?: string })?.id || "";
			const userEmail = user?.email || "";

			let newField: Omit<SignatureField, "id">;

			if (isMarkingMode) {
				// Create placeholder field for recipient
				newField = {
					recipientId: "placeholder", // Special recipientId for placeholders
					type: selectedFieldType as "signature" | "initial" | "date" | "text",
					pageNumber: currentPage,
					xPct: x,
					yPct: y,
					wPct: wPct,
					hPct: hPct,
					fontId: SIGNATURE_FONTS[0].id,
					placeholder: true, // Mark as placeholder
					placeholderText: FIELD_TYPES.find(f => f.id === selectedFieldType)?.label || "Field",
				};
				// Exit marking mode after placing field
				setIsMarkingMode(false);
			} else {
				// Regular signature field for sender
				newField = {
					recipientId: userEmail || userId || "current-user",
					type: "signature",
					pageNumber: currentPage,
					xPct: x,
					yPct: y,
					wPct: wPct,
					hPct: hPct,
					fontId: SIGNATURE_FONTS[0].id,
				};
			}



			onFieldAdd?.(currentPage, newField);
		},
		[editable, currentPage, onFieldAdd, isMarkingMode, selectedFieldType, user]
	);

	const handlePageLoad = useCallback(() => {
		// Page loaded
	}, []);

	// Debug: Log document info
	// Use finalPdfUrl if available (signed document), otherwise use original pdfUrl
	const pdfUrlToUse = template.finalPdfUrl || template.pdfUrl || template.metadata?.originalPdfPath;



	return (
		<div className={`space-y-4 ${className}`}>
			{/* Signing Progress */}
			{showSigningProgress && template.recipients && template.recipients.length > 0 && (
				<SigningProgress
					recipients={template.recipients}
					currentUserEmail={user?.email}
				/>
			)}

			{/* Controls */}
			<div className="flex items-center justify-between bg-white border border-gray-200 rounded-lg p-4">
				<div className="flex items-center space-x-4">
					<button
						onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
						disabled={currentPage === 1}
						className="p-2 text-gray-400 hover:text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
						title="Previous page"
					>
						<ChevronLeft className="h-5 w-5" />
					</button>

					<span className="text-sm font-medium">
						Page {currentPage} of {template.numPages}
					</span>

					<button
						onClick={() => setCurrentPage((prev) => Math.min(template.numPages, prev + 1))}
						disabled={currentPage === template.numPages}
						className="p-2 text-gray-400 hover:text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
						title="Next page"
					>
						<ChevronRight className="h-5 w-5" />
					</button>
				</div>

				<div className="flex items-center space-x-2">
					<button
						onClick={handleZoomOut}
						disabled={zoom <= 0.25}
						className="p-2 text-gray-400 hover:text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
						title="Zoom out"
					>
						<ZoomOut className="h-4 w-4" />
					</button>

					<span className="text-sm font-medium min-w-[60px] text-center">
						{Math.round(zoom * 100)}%
					</span>

					<button
						onClick={handleZoomIn}
						disabled={zoom >= 3}
						className="p-2 text-gray-400 hover:text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
						title="Zoom in"
					>
						<ZoomIn className="h-4 w-4" />
					</button>

					<button
						onClick={handleRotate}
						className="p-2 text-gray-400 hover:text-gray-600"
						title="Rotate"
					>
						<RotateCw className="h-4 w-4" />
					</button>
				</div>
			</div>

			{/* Mark Place Section - Only show for document owners/senders */}
			{editable && template && user && template.createdBy === (user as any)?.id && (
				<div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-3">
							<MapPin className="h-5 w-5 text-blue-600" />
							<div>
								<h3 className="text-sm font-medium text-blue-900">Mark Places for Recipients</h3>
								<p className="text-xs text-blue-700">
									{isMarkingMode
										? `Click on the document to place a ${FIELD_TYPES.find(f => f.id === selectedFieldType)?.label} field`
										: hasSenderSigned()
											? "Create placeholders for recipients to fill in specific information"
											: "Sign the document first, then you can mark places for recipients"
									}
								</p>
							</div>
						</div>
						<div className="flex items-center gap-2">
							{isMarkingMode && (
								<button
									onClick={() => setIsMarkingMode(false)}
									className="px-3 py-1 text-sm bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-md transition-colors"
								>
									Cancel
								</button>
							)}
							<button
								onClick={() => {
									if (!hasSenderSigned()) {
										alert("You must sign the document first before marking places for recipients. Please click the green pen icon to add your signature.");
										return;
									}
									setShowMarkPlaceDialog(true);
								}}
								disabled={!hasSenderSigned()}
								className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${hasSenderSigned()
									? "bg-blue-600 hover:bg-blue-700 text-white"
									: "bg-gray-300 text-gray-500 cursor-not-allowed"
									}`}
								title={!hasSenderSigned() ? "Sign the document first before marking places" : "Mark places for recipients to sign"}
							>
								Mark Place
							</button>
						</div>
					</div>
				</div>
			)}

			{/* Viewer */}
			<div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
				<div
					className="relative overflow-auto bg-gray-100 flex items-start justify-center"
					style={{
						cursor: editable
							? isMarkingMode
								? "copy"
								: "crosshair"
							: "default",
						minHeight: "600px",
						padding: "20px",
					}}
				>
					<div className="relative" style={{ maxWidth: "850px", width: "100%" }}>
						<DndContext onDragEnd={handleDragEnd}>
							<div
								ref={contentRef}
								className="relative w-full"
								style={{
									transform: `scale(${zoom}) rotate(${rotation}deg)`,
									transformOrigin: "center top",
									transition: "transform 0.2s ease-in-out",
								}}
								onClick={(e) => handleCanvasClick(e as unknown as React.MouseEvent<HTMLDivElement>)}
							>
								{/* Viewer - Always use PDF (Word docs are converted to PDF on backend) */}
								{/* Use finalPdfUrl if available (signed document with fields), otherwise original PDF */}
								{pdfUrlToUse ? (
									<PDFPageCanvas
										pdfUrl={ensureAbsoluteUrl(pdfUrlToUse)}
										pageNumber={currentPage}
										zoom={1} // Apply zoom via CSS transform instead
										rotation={0} // Apply rotation via CSS transform instead
										onPageLoad={handlePageLoad}
										className="w-full"
									/>
								) : (
									<div className="flex items-center justify-center w-full min-h-[600px] bg-red-50 border border-red-200 rounded-lg">
										<div className="text-center p-8">
											<p className="text-red-600 font-medium mb-2">
												No PDF available for this template
											</p>
											<p className="text-red-500 text-sm">
												This template may need to be re-uploaded
											</p>
										</div>
									</div>
								)}

								{/* Signature Fields Overlay - using new DraggableField component */}
								{currentPageFields.map((field) => (
									<DraggableField key={field.id} field={field} />
								))}
							</div>
						</DndContext>
					</div>
				</div>
			</div>

			{/* Page Info */}
			<div className="text-sm text-gray-600 bg-gray-50 rounded-lg p-4">
				<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
					<div>
						<strong>Page:</strong> {currentPage} / {template.numPages}
					</div>
					<div>
						<strong>Fields:</strong> {currentPageFields.length}
					</div>
					<div>
						<strong>Zoom:</strong> {Math.round(zoom * 100)}%
					</div>
					<div>
						<strong>Rotation:</strong> {rotation}°
					</div>
				</div>
				{editable && (
					<div className="mt-2 text-blue-600">
						💡 Click anywhere on the document to add a signature field
					</div>
				)}
			</div>

			{/* Mark Place Dialog */}
			{showMarkPlaceDialog && (
				<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4">
					<div className="bg-white rounded-lg shadow-xl max-w-sm w-full max-h-[80vh] overflow-y-auto">
						<div className="p-4">
							<div className="flex items-center justify-between mb-3">
								<h3 className="text-lg font-semibold text-gray-900">Mark Place</h3>
								<button
									onClick={() => setShowMarkPlaceDialog(false)}
									className="text-gray-400 hover:text-gray-600 transition-colors"
								>
									<X className="h-5 w-5" />
								</button>
							</div>

							<p className="text-sm text-gray-600 mb-3">
								Select field type for recipient to fill:
							</p>

							<div className="space-y-1.5 mb-4">
								{FIELD_TYPES.map((fieldType) => (
									<button
										key={fieldType.id}
										onClick={() => setSelectedFieldType(fieldType.id)}
										className={`w-full p-2 text-left border rounded-md transition-all ${selectedFieldType === fieldType.id
											? "border-blue-600 bg-blue-50"
											: "border-gray-200 hover:border-gray-300"
											}`}
									>
										<div className="flex items-center gap-2">
											<span className="text-sm">{fieldType.icon}</span>
											<div>
												<div className="text-sm font-medium text-gray-900">{fieldType.label}</div>
												<div className="text-xs text-gray-500">{fieldType.description}</div>
											</div>
										</div>
									</button>
								))}
							</div>

							<div className="flex gap-2 mt-3">
								<button
									onClick={() => setShowMarkPlaceDialog(false)}
									className="flex-1 px-3 py-2 text-sm border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
								>
									Cancel
								</button>
								<button
									onClick={() => {
										setShowMarkPlaceDialog(false);
										setIsMarkingMode(true);
									}}
									className="flex-1 px-3 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors"
								>
									Start Marking
								</button>
							</div>
						</div>
					</div>
				</div>
			)}

			{/* Signature Pad Modal for recipient signing */}
			{activeSignatureField && (
				<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
					<div className="bg-white rounded-lg shadow-xl max-w-2xl w-full">
						<SignaturePad
							field={activeSignatureField}
							onSignatureComplete={handleSignatureComplete}
							onClose={() => setActiveSignatureField(null)}
						/>
					</div>
				</div>
			)}
		</div >
	);
};
