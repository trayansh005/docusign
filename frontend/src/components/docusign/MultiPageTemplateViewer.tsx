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
	X,
} from "lucide-react";
import { DndContext, useDraggable, DragEndEvent } from "@dnd-kit/core";
import { ensureAbsoluteUrl } from "@/lib/urlUtils";
import { DocuSignTemplateData, SignatureField } from "@/types/docusign";
import { Recipient } from "@/components/FomiqDashboard/types";
import { getRecipientColor } from "@/constants/recipientColors";
import { useAuthStore } from "@/stores/authStore";
import { SignaturePad } from "./SignaturePad";
import { SIGNATURE_FONTS } from "@/constants/signatureFonts";
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
	showMarkPlaceDialog?: boolean;
	setShowMarkPlaceDialog?: (show: boolean) => void;
	isMarkingMode?: boolean;
	setIsMarkingMode?: (mode: boolean) => void;
	selectedFieldType?: string | null;
	setSelectedFieldType?: (type: string | null) => void;
	selectedRecipient?: Recipient | null;
	setSelectedRecipient?: (recipient: Recipient | null) => void;
	currentPage?: number;
	setCurrentPage?: (page: number) => void;
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
	showMarkPlaceDialog: externalShowMarkPlaceDialog,
	setShowMarkPlaceDialog: externalSetShowMarkPlaceDialog,
	isMarkingMode: externalIsMarkingMode,
	setIsMarkingMode: externalSetIsMarkingMode,
	selectedFieldType: externalSelectedFieldType,
	setSelectedFieldType: externalSetSelectedFieldType,
	selectedRecipient: externalSelectedRecipient,
	currentPage: externalCurrentPage,
	setCurrentPage: externalSetCurrentPage,
}) => {
	const [internalCurrentPage, setInternalCurrentPage] = useState(1);
	const currentPage = externalCurrentPage !== undefined ? externalCurrentPage : internalCurrentPage;
	const setCurrentPage = externalSetCurrentPage || setInternalCurrentPage;

	const [zoom, setZoom] = useState(1);
	const [rotation, setRotation] = useState(0);
	const contentRef = useRef<HTMLDivElement | null>(null);

	// Use external state if provided, otherwise use internal state
	const [internalActiveField, setInternalActiveField] = useState<SignatureField | null>(null);
	const activeSignatureField =
		externalActiveField !== undefined ? externalActiveField : internalActiveField;
	const setActiveSignatureField = externalSetActiveField || setInternalActiveField;

	// Mark Place dialog state - use external state if provided
	const [internalShowMarkPlaceDialog, setInternalShowMarkPlaceDialog] = useState(false);
	const showMarkPlaceDialog =
		externalShowMarkPlaceDialog !== undefined
			? externalShowMarkPlaceDialog
			: internalShowMarkPlaceDialog;
	const setShowMarkPlaceDialog = externalSetShowMarkPlaceDialog || setInternalShowMarkPlaceDialog;

	const [internalSelectedFieldType, setInternalSelectedFieldType] = useState<string>("signature");
	const selectedFieldType =
		externalSelectedFieldType !== undefined ? externalSelectedFieldType : internalSelectedFieldType;
	const setSelectedFieldType = externalSetSelectedFieldType || setInternalSelectedFieldType;

	const [internalIsMarkingMode, setInternalIsMarkingMode] = useState(false);
	const isMarkingMode =
		externalIsMarkingMode !== undefined ? externalIsMarkingMode : internalIsMarkingMode;
	const setIsMarkingMode = externalSetIsMarkingMode || setInternalIsMarkingMode;

	// Get logged-in user
	const user = useAuthStore((state) => state.user);

	// Helper: robustly resolve template owner id whether `createdBy` is an ObjectId/string or populated object
	const resolveTemplateOwnerId = useCallback((): string | null => {
		if (!template) return null;
		const cbRaw: unknown = (template as unknown as Record<string, unknown>)["createdBy"];
		if (cbRaw == null) return null;
		if (typeof cbRaw === "string" || typeof cbRaw === "number") return String(cbRaw);
		if (typeof cbRaw === "object") {
			const obj = cbRaw as Record<string, unknown>;
			if (obj["_id"]) return String(obj["_id"]);
			if (obj["id"]) return String(obj["id"]);
			return null;
		}
		return null;
	}, [template]);

	const isOwner = useCallback(() => {
		const ownerId = resolveTemplateOwnerId();
		if (!ownerId || !user) return false;
		return String(ownerId) === String(user?.id);
	}, [resolveTemplateOwnerId, user]);

	// Get user's full name for signature fields
	const userFullName =
		user?.firstName && user?.lastName ? `${user.firstName} ${user.lastName}` : "Your Signature";

	const userInitials =
		user?.firstName && user?.lastName ? `${user.firstName[0]}${user.lastName[0]}` : "YI";

	// Handle signature field click (for recipients to fill in)
	const handleFieldClick = useCallback(
		(field: SignatureField, e: React.MouseEvent) => {
			e.stopPropagation();
			// DEBUG: Log clicks on fields to help diagnose why signature pad may not open
			try {
				console.debug("[MultiPageTemplateViewer] handleFieldClick", {
					fieldId: field.id,
					field,
					editable,
				});
			} catch {
				/* ignore */
			}
			// Check if this field belongs to the current user
			const userId = (user as { id?: string })?.id || "";
			const userEmail = user?.email || "";

			const isMyField =
				user &&
				(field.recipientId === userEmail ||
					field.recipientId === userId ||
					!field.recipientId || // Handle fields without recipientId (newly created fields)
					field.recipientId === "current-user" || // Handle fields created with fallback recipientId
					field.recipientId?.includes("current-user")); // Handle variations

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
		(fieldId: string, signatureData: string, meta?: { fontId?: string; isPlainText?: boolean }) => {
			if (onFieldUpdate) {
				const field = template.signatureFields.find((f) => f.id === fieldId);
				const userId = (user as { id?: string })?.id || "";
				const userEmail = user?.email || "";

				// If it's a placeholder field, convert it to a regular field assigned to current user
				const patch: Partial<SignatureField> = { value: signatureData };
				if (meta?.fontId) patch.fontId = meta.fontId;

				if (field?.placeholder && field.recipientId === "placeholder") {
					onFieldUpdate(currentPage, fieldId, {
						...patch,
						recipientId: userEmail || userId || "current-user",
						placeholder: false,
						placeholderText: undefined,
					});
				} else {
					onFieldUpdate(currentPage, fieldId, patch);
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
		const isDocumentOwner = isOwner();
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
		let labelBgColor;

		if (isPlaceholder && field.recipientName) {
			// Use recipient's color for their fields
			// Extract signing order from recipients list or use a fallback
			const recipients = template.recipients || [];
			const recipient = recipients.find(
				(r) => r.id === field.recipientId || r.name === field.recipientName
			);

			if (recipient && recipient.signingOrder) {
				const colorScheme = getRecipientColor(recipient.signingOrder - 1);
				fieldColor = `border-2 ${colorScheme.border} bg-opacity-10 ${colorScheme.bg}`;
				labelBgColor = colorScheme.bg;
			} else {
				// Fallback to orange if recipient not found
				fieldColor = "border-2 border-orange-400 bg-orange-50";
				labelBgColor = "bg-orange-500";
			}
		} else if (hasSigned) {
			fieldColor = "border-green-500 bg-green-50"; // Green for completed
			labelBgColor = "bg-green-500";
		} else {
			fieldColor = "border-blue-400 bg-blue-50"; // Blue for regular fields
			labelBgColor = "bg-blue-500";
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
				{/* Recipient name label - shown above the field for recipient fields */}
				{field.placeholder && field.recipientName && (
					<div
						className={`absolute ${labelBgColor} text-white text-xs px-2 py-1 rounded-t-md shadow-sm font-medium whitespace-nowrap z-20`}
						style={{
							left: `${field.xPct || 0}%`,
							top: `calc(${field.yPct || 0}% - 22px)`,
							maxWidth: `${field.wPct || 25}%`,
						}}
					>
						{field.recipientName}
					</div>
				)}

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
						${
							isDragging || isResizing
								? "shadow-2xl scale-110 ring-2 ring-blue-400 ring-opacity-50"
								: "shadow-lg hover:scale-105"
						}
						group select-none ${
							isResizing
								? "cursor-se-resize"
								: field.placeholder
								? "cursor-pointer"
								: editable
								? "cursor-move"
								: "cursor-pointer"
						}`}
				>
					<div className="flex flex-col items-center justify-center p-3 text-center min-w-0">
						{(() => {
							const isImage =
								(field.type === "signature" || field.type === "initial") &&
								field.value &&
								field.value.startsWith("data:image");
							console.log(`[MultiPageTemplateViewer] Field ${field.id}:`, {
								type: field.type,
								hasValue: !!field.value,
								valueLength: field.value?.length,
								isImage,
								valuePreview: field.value?.substring(0, 50),
							});
							return isImage;
						})() ? (
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
								className={`font-semibold truncate max-w-full ${
									field.placeholder ? "text-gray-600" : "text-gray-800"
								}`}
								style={{
									fontFamily: getFontFamily(),
									fontSize:
										field.type === "text" ||
										field.type === "name" ||
										field.type === "email" ||
										field.type === "phone" ||
										field.type === "address"
											? "16px"
											: getDynamicFontSize(),
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
				{editable && isOwner() && (
					<>
						{/* Delete button - shown for sender's own fields AND placeholder fields */}
						{(!field.placeholder || (field.placeholder && isOwner())) && (
							<button
								type="button"
								className={`absolute w-7 h-7 rounded-full bg-red-500 text-white shadow-lg transition-all duration-200 flex items-center justify-center z-10 hover:bg-red-600 pointer-events-auto ${
									isDragging ? "opacity-0" : "opacity-100"
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
								title={field.placeholder ? "Delete recipient field" : "Delete field"}
							>
								<Trash2 className="w-3.5 h-3.5" />
							</button>
						)}

						{/* Font selection button - only for sender's own signature/initial fields */}
						{!field.placeholder && (field.type === "signature" || field.type === "initial") && (
							<button
								type="button"
								className={`absolute w-7 h-7 rounded-full bg-purple-600 text-white shadow-lg transition-all duration-200 flex items-center justify-center z-10 hover:bg-purple-700 pointer-events-auto ${
									isDragging ? "opacity-0" : "opacity-100"
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
								title={`Change font style (${
									SIGNATURE_FONTS.find((font) => font.id === field.fontId)?.name ||
									SIGNATURE_FONTS[0].name
								})`}
							>
								<Palette className="w-3.5 h-3.5" />
							</button>
						)}

						{/* Sign/Draw button - Opens signature pad - only for sender's own fields */}
						{!field.placeholder && (field.type === "signature" || field.type === "initial") && (
							<button
								type="button"
								className={`absolute w-8 h-8 rounded-full bg-green-600 text-white shadow-xl transition-all duration-200 flex items-center justify-center hover:bg-green-700 hover:scale-110 pointer-events-auto cursor-pointer border-2 border-white ${
									isDragging ? "opacity-0 pointer-events-none" : "opacity-100"
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

			// DEBUG: Log canvas click coordinates and state for troubleshooting
			try {
				console.debug("[MultiPageTemplateViewer] handleCanvasClick fired", {
					clientX: e.clientX,
					clientY: e.clientY,
					currentPage,
					isMarkingMode,
					selectedFieldType,
				});
			} catch {
				/* ignore */
			}

			// Only document owners can add new fields by clicking on canvas
			// Recipients should only fill existing placeholder fields
			const isDocumentOwner = isOwner();

			// DEBUG: log ownership check so we know why clicks may be ignored
			try {
				console.debug("[MultiPageTemplateViewer] isDocumentOwner?", {
					isDocumentOwner,
					templateCreatedBy: template?.createdBy?._id,
					userId: user?.id,
				});
			} catch {
				/* ignore */
			}

			if (!isDocumentOwner) {
				// DEBUG: indicate early return due to ownership
				try {
					console.debug("[MultiPageTemplateViewer] handleCanvasClick ignored - not document owner");
				} catch {
					/* ignore */
				}
				return;
			}

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

			// Normalize and clamp
			let xPct = Number.isFinite(x) ? Math.max(0, Math.min(100, x)) : 0;
			let yPct = Number.isFinite(y) ? Math.max(0, Math.min(100, y)) : 0;
			// Round to 4 decimals for storage/display
			xPct = Math.round(xPct * 10000) / 10000;
			yPct = Math.round(yPct * 10000) / 10000;

			// DEBUG: log rect and computed percentages to diagnose percent vs decimal mismatch
			try {
				console.debug("[MultiPageTemplateViewer] Canvas click rect/coords", {
					rect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
					clientX: e.clientX,
					clientY: e.clientY,
					xPct,
					yPct,
					zoom,
					rotation,
				});
			} catch {
				/* ignore */
			}

			// Fixed field size for consistency
			const wPct = 25; // 25% of page width
			const hPct = 8; // 8% of page height

			const userId = (user as { id?: string })?.id || "";
			const userEmail = user?.email || "";

			// Get selected recipient info
			const selectedRecipient = externalSelectedRecipient;

			let newField: Omit<SignatureField, "id">;

			if (isMarkingMode && selectedRecipient) {
				// Create field assigned to specific recipient
				newField = {
					recipientId: selectedRecipient.id,
					recipientName: selectedRecipient.name, // Store recipient name for display
					type: selectedFieldType as "signature" | "initial" | "date" | "text",
					pageNumber: currentPage,
					xPct: xPct,
					yPct: yPct,
					wPct: wPct,
					hPct: hPct,
					fontId: SIGNATURE_FONTS[0].id,
					placeholder: true, // Mark as placeholder for recipients to fill
					placeholderText: FIELD_TYPES.find((f) => f.id === selectedFieldType)?.label || "Field",
				};
				// Keep marking mode and selected recipient active so the sender can place
				// multiple fields for the same recipient without re-selecting.
			} else {
				// Regular signature field for sender - check if sender already has signature on this page
				const senderSignaturesOnPage = template.signatureFields.filter(
					(field) =>
						field.pageNumber === currentPage &&
						!field.placeholder &&
						(field.type === "signature" || field.type === "initial") &&
						(field.recipientId === userEmail ||
							field.recipientId === userId ||
							field.recipientId === "current-user" ||
							field.recipientId?.includes("current-user") ||
							!field.recipientId)
				);

				if (senderSignaturesOnPage.length > 0) {
					// Silently prevent placing another signature on the same page
					return;
				}

				// Regular signature field for sender
				newField = {
					recipientId: userEmail || userId || "current-user",
					type: "signature",
					pageNumber: currentPage,
					xPct: xPct,
					yPct: yPct,
					wPct: wPct,
					hPct: hPct,
					fontId: SIGNATURE_FONTS[0].id,
				};
			}

			// DEBUG: log the new field object before sending to parent
			try {
				console.debug("[MultiPageTemplateViewer] New field to add", { newField });
			} catch {
				/* ignore */
			}

			onFieldAdd?.(currentPage, newField);
		},
		[
			editable,
			currentPage,
			onFieldAdd,
			isMarkingMode,
			selectedFieldType,
			externalSelectedRecipient,
			user,
			template,
			zoom,
			rotation,
			isOwner,
		]
	);

	const handlePageLoad = useCallback(() => {
		// Page loaded
	}, []);

	// Debug: Log document info
	// Use finalPdfUrl if available (signed document), otherwise use original pdfUrl
	const pdfUrlToUse = template.finalPdfUrl || template.pdfUrl || template.metadata?.originalPdfPath;

	return (
		<div className={`flex flex-col h-full ${className}`}>
			{/* Signing Progress */}
			{showSigningProgress && template.recipients && template.recipients.length > 0 && (
				<SigningProgress recipients={template.recipients} currentUserEmail={user?.email} />
			)}

			{/* Top Toolbar */}
			<div className="flex items-center justify-between bg-white border-b border-gray-200 px-4 py-2">
				<div className="flex items-center space-x-2">
					<button
						onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
						disabled={currentPage === 1}
						className="p-1.5 text-gray-400 hover:text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 rounded"
						title="Previous page"
					>
						<ChevronLeft className="h-4 w-4" />
					</button>

					<span className="text-xs font-medium text-gray-700 min-w-[80px] text-center">
						{currentPage} of {template.numPages}
					</span>

					<button
						onClick={() => setCurrentPage(Math.min(template.numPages, currentPage + 1))}
						disabled={currentPage === template.numPages}
						className="p-1.5 text-gray-400 hover:text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 rounded"
						title="Next page"
					>
						<ChevronRight className="h-4 w-4" />
					</button>
				</div>

				<div className="flex items-center space-x-2">
					<button
						onClick={handleZoomOut}
						disabled={zoom <= 0.25}
						className="p-1.5 text-gray-400 hover:text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 rounded"
						title="Zoom out"
					>
						<ZoomOut className="h-3.5 w-3.5" />
					</button>

					<span className="text-xs font-medium text-gray-700 min-w-[50px] text-center">
						{Math.round(zoom * 100)}%
					</span>

					<button
						onClick={handleZoomIn}
						disabled={zoom >= 3}
						className="p-1.5 text-gray-400 hover:text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 rounded"
						title="Zoom in"
					>
						<ZoomIn className="h-3.5 w-3.5" />
					</button>

					<div className="w-px h-5 bg-gray-300 mx-1"></div>

					<button
						onClick={handleRotate}
						className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
						title="Rotate"
					>
						<RotateCw className="h-3.5 w-3.5" />
					</button>
				</div>
			</div>

			{/* Viewer */}
			<div className="flex-1 overflow-hidden bg-gray-100">
				<div
					className="relative overflow-auto h-full flex items-start justify-center"
					style={{
						cursor: editable ? (isMarkingMode ? "copy" : "crosshair") : "default",
						padding: "20px",
					}}
				>
					<div className="relative" style={{ maxWidth: "850px", width: "100%" }}>
						<DndContext onDragEnd={handleDragEnd}>
							<div
								ref={contentRef}
								className="relative w-full bg-white shadow-lg"
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

							<p className="text-sm text-gray-600 mb-3">Select field type for recipient to fill:</p>

							<div className="space-y-1.5 mb-4">
								{FIELD_TYPES.map((fieldType) => (
									<button
										key={fieldType.id}
										onClick={() => setSelectedFieldType(fieldType.id)}
										className={`w-full p-2 text-left border rounded-md transition-all ${
											selectedFieldType === fieldType.id
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
		</div>
	);
};
