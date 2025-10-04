"use client";

import React, { useState, useCallback, useRef } from "react";
// Image optimization not used here; using plain <img> for exact pixel control
import { useQuery } from "@tanstack/react-query";
import {
	ChevronLeft,
	ChevronRight,
	ZoomIn,
	ZoomOut,
	RotateCw,
	AlertCircle,
	Trash2,
} from "lucide-react";
import { getTemplatePage } from "@/services/docusignAPI";
import { ensureAbsoluteUrl } from "@/lib/urlUtils";
import { DocuSignTemplateData, SignatureField } from "@/types/docusign";

interface MultiPageTemplateViewerProps {
	template: DocuSignTemplateData;
	onFieldAdd?: (pageNumber: number, field: Omit<SignatureField, "id">) => void;
	onFieldRemove?: (pageNumber: number, fieldId: string) => void;
	onFieldUpdate?: (pageNumber: number, fieldId: string, patch: Partial<SignatureField>) => void;
	editable?: boolean;
	className?: string;
}

export const MultiPageTemplateViewer: React.FC<MultiPageTemplateViewerProps> = ({
	template,
	onFieldAdd,
	onFieldRemove,
	onFieldUpdate,
	editable = false,
	className = "",
}) => {
	const [currentPage, setCurrentPage] = useState(1);
	const [zoom, setZoom] = useState(1);
	const [rotation, setRotation] = useState(0);
	const contentRef = useRef<HTMLDivElement | null>(null);

	// Drag state for moving/resizing fields
	type DragState = {
		mode?: "drag" | "resize";
		fieldId?: string;
		pageNumber?: number;
		startClientX?: number;
		startClientY?: number;
		startX?: number;
		startY?: number;
		startW?: number;
		startH?: number;
	} | null;
	const dragStateRef = useRef<DragState>(null);

	const handleWindowMouseMove = (e: MouseEvent) => {
		const ds = dragStateRef.current;
		if (!ds || !ds.fieldId) return;
		const rect = contentRef.current?.getBoundingClientRect();
		if (!rect) return;
		const width = rect.width || 1;
		const height = rect.height || 1;
		if (
			ds.startClientX == null ||
			ds.startClientY == null ||
			ds.startX == null ||
			ds.startY == null
		)
			return;
		const deltaX = ((e.clientX - ds.startClientX) / width) * 100;
		const deltaY = ((e.clientY - ds.startClientY) / height) * 100;

		if (ds.mode === "drag") {
			const newX = Math.max(0, Math.min(100, ds.startX + deltaX));
			const newY = Math.max(0, Math.min(100, ds.startY + deltaY));
			if (typeof onFieldUpdate === "function" && ds.pageNumber != null && ds.fieldId)
				onFieldUpdate(ds.pageNumber, ds.fieldId, { xPct: newX, yPct: newY });
		} else if (ds.mode === "resize") {
			if (ds.startW == null || ds.startH == null) return;
			const newW = Math.max(1, Math.min(100, ds.startW + deltaX));
			const newH = Math.max(1, Math.min(100, ds.startH + deltaY));
			if (typeof onFieldUpdate === "function" && ds.pageNumber != null && ds.fieldId)
				onFieldUpdate(ds.pageNumber, ds.fieldId, { wPct: newW, hPct: newH });
		}
	};

	const handleWindowMouseUp = () => {
		const ds = dragStateRef.current;
		if (ds && ds.fieldId && typeof onFieldUpdate === "function" && ds.pageNumber != null) {
			// commit final values based on mode
			if (ds.mode === "drag") {
				// nothing special to commit: onFieldUpdate was called during move
			} else if (ds.mode === "resize") {
				if (ds.startW != null && ds.startH != null) {
					onFieldUpdate(ds.pageNumber, ds.fieldId, { wPct: ds.startW, hPct: ds.startH });
				}
			}
		}
		dragStateRef.current = null;
		window.removeEventListener("mousemove", handleWindowMouseMove);
		window.removeEventListener("mouseup", handleWindowMouseUp);
	};

	const attachWindowListeners = () => {
		window.addEventListener("mousemove", handleWindowMouseMove);
		window.addEventListener("mouseup", handleWindowMouseUp);
	};

	const {
		data: pageData,
		error,
	} = useQuery({
		queryKey: ["template-page", template._id, currentPage],
		queryFn: () => getTemplatePage(template._id, currentPage),
		enabled: !!template._id && currentPage > 0,
	});

	const currentPageFields = template.signatureFields.filter(
		(field) => field.pageNumber === currentPage
	);

	const handleZoomIn = () => setZoom((prev) => Math.min(prev + 0.25, 3));
	const handleZoomOut = () => setZoom((prev) => Math.max(prev - 0.25, 0.25));
	const handleRotate = () => setRotation((prev) => (prev + 90) % 360);

	const handleCanvasClick = useCallback(
		(e: React.MouseEvent<HTMLDivElement>) => {
			if (!editable) return;

			// Prefer measuring the inner content (which is transformed/scaled). Fallback to currentTarget.
			const targetRect =
				(contentRef.current && contentRef.current.getBoundingClientRect()) ||
				(e.currentTarget && e.currentTarget.getBoundingClientRect());
			const rect = targetRect || { left: 0, top: 0, width: 1, height: 1 };
			const width = rect.width || 1;
			const height = rect.height || 1;
			const x = ((e.clientX - rect.left) / width) * 100;
			const y = ((e.clientY - rect.top) / height) * 100;

			// default pixel sizes (A4-friendly defaults) then convert to percent of page
			const defaultPx = { w: 300, h: 80 };
			const wPct = Math.min(100, (defaultPx.w / width) * 100);
			const hPct = Math.min(100, (defaultPx.h / height) * 100);

			// Add a signature field at clicked position
			const newField: Omit<SignatureField, "id"> = {
				recipientId: "recipient-1", // Default recipient
				type: "signature",
				pageNumber: currentPage,
				xPct: x,
				yPct: y,
				wPct: Math.max(5, wPct || 20), // Default width percentage (converted from px)
				hPct: Math.max(3, hPct || 5), // Default height percentage (converted from px)
			};

			console.debug(
				`[DEBUG] viewer click -> page=${currentPage} xPct=${x.toFixed(2)} yPct=${y.toFixed(2)}`
			);

			onFieldAdd?.(currentPage, newField);
		},
		[editable, currentPage, onFieldAdd]
	);

	const renderSignatureField = (field: SignatureField) => {
			const style: React.CSSProperties = {
			position: "absolute",
			left: `${field.xPct}%`,
			top: `${field.yPct}%`,
			width: `${field.wPct}%`,
			height: `${field.hPct}%`,
			border: editable ? "1px dashed rgba(59,130,246,0.25)" : "1px dashed rgba(0,0,0,0.05)",
			backgroundColor: editable ? "rgba(59, 130, 246, 0.03)" : "transparent",
			display: "flex",
			alignItems: "center",
			justifyContent: "center",
			fontSize: "12px",
			color: field.type === "signature" || field.type === "initial" ? "#111827" : (editable ? "#0f172a" : "#4b5563"),
			fontWeight: field.type === "signature" || field.type === "initial" ? 400 : 600,
			pointerEvents: editable ? "auto" : "none",
			cursor: editable ? "move" : "default",
		};

		const fieldTypeLabels = {
			signature: "SIGN",
			date: "DATE",
			initial: "INIT",
			text: "TEXT",
		};

		// Drag/resize handlers
		// ensure dragState object exists
		const dragState = (dragStateRef.current = dragStateRef.current || {});

		const onFieldMouseDown = (e: React.MouseEvent) => {
			if (!editable) return;
			e.stopPropagation();
			// start dragging
			dragState.mode = "drag";
			dragState.fieldId = field.id;
			dragState.pageNumber = currentPage;
			dragState.startClientX = e.clientX;
			dragState.startClientY = e.clientY;
			dragState.startX = field.xPct;
			dragState.startY = field.yPct;
			dragState.startW = field.wPct;
			dragState.startH = field.hPct;
			attachWindowListeners();
		};

		// prevent click inside field from bubbling to canvas (which would add new field)
		const onFieldClick = (e: React.MouseEvent) => {
			e.stopPropagation();
		};

		const onResizeMouseDown = (e: React.MouseEvent) => {
			if (!editable) return;
			e.stopPropagation();
			dragState.mode = "resize";
			dragState.fieldId = field.id;
			dragState.pageNumber = currentPage;
			dragState.startClientX = e.clientX;
			dragState.startClientY = e.clientY;
			dragState.startX = field.xPct;
			dragState.startY = field.yPct;
			dragState.startW = field.wPct;
			dragState.startH = field.hPct;
			attachWindowListeners();
		};

		return (
			<div
				key={field.id}
				style={style}
				className="rounded group"
				onMouseDown={onFieldMouseDown}
				onClick={onFieldClick}
				title={
					editable
						? "Drag to move. Drag corner to resize. Click X to remove"
						: fieldTypeLabels[field.type]
				}
			>
				<div className="w-full h-full flex items-center justify-center select-none min-w-0 px-2">
					{/* Render label or actual signature text styled like RCSS */}
					<span
						className="truncate"
						style={{
							fontFamily:
								field.type === "signature" || field.type === "initial"
									? "var(--font-dancing-script), 'Dancing Script', 'Brush Script MT', cursive"
									: "inherit",
							fontSize: (() => {
								// Compute font size from pixel height if possible
								const rect = contentRef.current?.getBoundingClientRect();
								if (!rect) return "12px";
								const pixelHeight = (field.hPct / 100) * rect.height;
								let sizeFactor = 12;
								switch (field.type) {
									case "signature":
										sizeFactor = Math.min(Math.max(pixelHeight * 0.45, 10), 40);
										break;
									case "initial":
										sizeFactor = Math.min(Math.max(pixelHeight * 0.6, 8), 36);
										break;
									case "date":
										sizeFactor = Math.min(Math.max(pixelHeight * 0.35, 8), 18);
										break;
									case "text":
										sizeFactor = Math.min(Math.max(pixelHeight * 0.35, 8), 20);
										break;
									default:
										sizeFactor = Math.min(Math.max(pixelHeight * 0.4, 10), 20);
								}
								return `${Math.round(sizeFactor)}px`;
							})(),
							lineHeight: 1.1,
							fontWeight: field.type === "signature" || field.type === "initial" ? 400 : 600,
							letterSpacing:
								field.type === "signature" || field.type === "initial" ? "0.4px" : "normal",
						}}
					>
						{field.type === "signature" || field.type === "initial"
							? field.value && field.value.length > 0
								? field.value
								: field.type === "initial"
								? field.value || "IN"
								: field.value || "Your Signature"
							: fieldTypeLabels[field.type]}
					</span>
				</div>

				{/* Delete button - visible on hover */}
                {editable && (
                    <button
                        type="button"
                        onClick={(ev) => {
                            ev.stopPropagation();
                            onFieldRemove?.(currentPage, field.id);
                        }}
                        title="Delete field"
                        className="absolute -top-3 -right-3 w-7 h-7 rounded-full bg-red-500 text-white shadow-lg opacity-0 group-hover:opacity-100 transition-all duration-150 flex items-center justify-center z-20 hover:bg-red-600"
                    >
                        <Trash2 className="w-3.5 h-3.5" />
                    </button>
                )}

                {editable && (
                    <div
                        onMouseDown={onResizeMouseDown}
                        className="absolute -bottom-1 -right-1 w-4 h-4 bg-blue-600 border-2 border-white rounded-full cursor-se-resize opacity-0 group-hover:opacity-100 transition-all duration-200 hover:bg-blue-700 hover:scale-110 shadow-md"
                        style={{ transform: "translate(50%, 50%)", zIndex: 30 }}
                        title="Drag to resize"
                    />
                )}

			</div>
		);
	};

	if (error) {
		return (
			<div className={`flex items-center justify-center p-8 bg-red-50 rounded-lg ${className}`}>
				<AlertCircle className="h-8 w-8 text-red-500 mr-2" />
				<span className="text-red-700">Failed to load page {currentPage}</span>
			</div>
		);
	}

	return (
		<div className={`space-y-4 ${className}`}>
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

			{/* Viewer */}
			<div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
				<div
					className="relative overflow-auto bg-gray-50"
					style={{
						cursor: editable ? "crosshair" : "default",
						minHeight: "600px",
					}}
				>
					{pageData?.imageUrl && (
						<div className="relative inline-block w-full max-w-4xl mx-auto">
							{/* A4 aspect-ratio wrapper */}
							<div
								className="relative bg-white"
								style={{
									aspectRatio: "1 / 1.4142",
									width: "100%",
									maxWidth: "100%",
									transformOrigin: "top left",
								}}
							>
								<div
									ref={contentRef}
									className="relative w-full h-full"
									style={{
										transform: `scale(${zoom}) rotate(${rotation}deg)`,
										transformOrigin: "top left",
										transition: "transform 0.2s ease-in-out",
										overflow: "hidden",
									}}
									onClick={(e) => handleCanvasClick(e as unknown as React.MouseEvent<HTMLDivElement>)}
								>
									{/* eslint-disable-next-line @next/next/no-img-element */}
									<img
										src={ensureAbsoluteUrl(pageData.imageUrl)}
										alt={`Page ${currentPage}`}
										className="w-full h-full object-contain block"
										style={{ imageRendering: zoom > 1 ? "pixelated" : "auto" }}
									/>

									{/* Signature Fields Overlay */}
									{currentPageFields.map(renderSignatureField)}
								</div>
							</div>
						</div>
					)}
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
		</div>
	);
};
