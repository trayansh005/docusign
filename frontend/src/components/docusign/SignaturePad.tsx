"use client";

import React, { useRef, useState, useEffect } from "react";
import { PenTool, Trash2, Save, Calendar, FileSignature } from "lucide-react";
import { SignatureField } from "@/types/docusign";

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

interface SignaturePadProps {
	field: SignatureField;
	onSignatureComplete: (fieldId: string, signatureData: string) => void;
	onClose: () => void;
	className?: string;
}

export const SignaturePad: React.FC<SignaturePadProps> = ({
	field,
	onSignatureComplete,
	onClose,
	className = "",
}) => {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const [isDrawing, setIsDrawing] = useState(false);
	const [hasDrawing, setHasDrawing] = useState(false);
	const [textValue, setTextValue] = useState<string>("");
	const [signatureMode, setSignatureMode] = useState<"draw" | "type">("draw");
	const [selectedFontId, setSelectedFontId] = useState<string>(SIGNATURE_FONTS[0].id);

	// Initialize canvas
	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;

		const ctx = canvas.getContext("2d");
		if (ctx) {
			// Keep canvas fully transparent so exported PNG has no background
			ctx.clearRect(0, 0, canvas.width, canvas.height);
			ctx.strokeStyle = "#000";
			ctx.lineWidth = 2;
			ctx.lineCap = "round";
			ctx.lineJoin = "round";
		}
	}, []);

	const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
		setIsDrawing(true);
		const canvas = canvasRef.current;
		if (!canvas) return;

		const rect = canvas.getBoundingClientRect();
		const scaleX = canvas.width / rect.width;
		const scaleY = canvas.height / rect.height;
		const x = (e.clientX - rect.left) * scaleX;
		const y = (e.clientY - rect.top) * scaleY;

		const ctx = canvas.getContext("2d");
		if (ctx) {
			ctx.beginPath();
			ctx.moveTo(x, y);
		}
	};

	const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
		if (!isDrawing) return;

		const canvas = canvasRef.current;
		if (!canvas) return;

		const rect = canvas.getBoundingClientRect();
		const scaleX = canvas.width / rect.width;
		const scaleY = canvas.height / rect.height;
		const x = (e.clientX - rect.left) * scaleX;
		const y = (e.clientY - rect.top) * scaleY;

		const ctx = canvas.getContext("2d");
		if (ctx) {
			ctx.lineTo(x, y);
			ctx.stroke();
			setHasDrawing(true);
		}
	};

	const stopDrawing = () => {
		setIsDrawing(false);
	};

	const handleClearSignature = () => {
		const canvas = canvasRef.current;
		if (!canvas) return;

		const ctx = canvas.getContext("2d");
		if (ctx) {
			// Clear to transparent
			ctx.clearRect(0, 0, canvas.width, canvas.height);
		}
		setHasDrawing(false);
		setTextValue("");
	};

	const handleSaveSignature = () => {
		// Save signature or text depending on mode

		const canvas = canvasRef.current;

		if (field.type === "signature" || field.type === "initial") {
			if (signatureMode === "draw") {
				// For drawing mode, save the canvas
				if (!canvas) {
					console.error("[SignaturePad] No canvas ref!");
					return;
				}

				if (hasDrawing) {
					const signatureData = canvas.toDataURL("image/png");
					onSignatureComplete(field.id, signatureData);
				} else {
					console.warn("[SignaturePad] No drawing to save!");
				}
			} else {
				// For type mode, render text into an image so backend can embed it
				if (textValue.trim()) {
					const text = textValue.trim();
					const width = 600;
					const height = 200;
					const pad = 20;
					const off = document.createElement("canvas");
					off.width = width;
					off.height = height;
					const ctx = off.getContext("2d");
					if (!ctx) return;
					// Keep transparent background in exported PNG
					// Fit font size to canvas width
					const fontFamily =
						SIGNATURE_FONTS.find((f) => f.id === selectedFontId)?.fontFamily ||
						"'Dancing Script', cursive";
					let fontSize = 100;
					const minSize = 18;
					while (fontSize > minSize) {
						ctx.font = `${fontSize}px ${fontFamily}`;
						const metrics = ctx.measureText(text);
						if (metrics.width <= width - pad * 2) break;
						fontSize -= 2;
					}
					ctx.font = `${fontSize}px ${fontFamily}`;
					ctx.fillStyle = "#000000";
					ctx.textBaseline = "middle";
					ctx.textAlign = "center";
					ctx.fillText(text, width / 2, height / 2);
					const dataUrl = off.toDataURL("image/png");
					onSignatureComplete(field.id, dataUrl);
				} else {
					console.warn("[SignaturePad] No text to save!");
				}
			}
		}
	};

	const getFieldIcon = () => {
		switch (field.type) {
			case "signature":
				return <PenTool className="h-4 w-4" />;
			case "initial":
				return <FileSignature className="h-4 w-4" />;
			case "date":
				return <Calendar className="h-4 w-4" />;
			case "text":
				return <PenTool className="h-4 w-4" />;
			default:
				return <PenTool className="h-4 w-4" />;
		}
	};

	const getFieldLabel = () => {
		switch (field.type) {
			case "signature":
				return "Signature";
			case "initial":
				return "Initial";
			case "date":
				return "Date";
			case "text":
				return "Text";
			default:
				return "Signature";
		}
	};

	const renderDateField = () => {
		const today = new Date().toLocaleDateString("en-US", {
			year: "numeric",
			month: "long",
			day: "numeric",
		});

		return (
			<div className="space-y-4">
				<div className="text-center p-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
					<Calendar className="mx-auto h-12 w-12 text-gray-300 mb-4" />
					<p className="text-lg font-medium text-gray-900">{today}</p>
					<p className="text-sm text-gray-500 mt-2">Current date will be applied</p>
				</div>
				<div className="flex gap-3">
					<button
						onClick={() => {
							console.log("Applying date for field:", field.id, "Value:", today);
							onSignatureComplete(field.id, today);
						}}
						className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
					>
						Apply Date
					</button>
					<button
						onClick={onClose}
						className="px-4 py-2 bg-gray-300 hover:bg-gray-400 text-gray-700 rounded-lg font-medium transition-colors"
					>
						Cancel
					</button>
				</div>
			</div>
		);
	};

	const renderTextField = () => {
		return (
			<div className="space-y-4">
				<div>
					<label className="block text-sm font-medium text-gray-700 mb-2">
						Enter text for this field:
					</label>
					<input
						type="text"
						value={textValue}
						onChange={(e) => setTextValue(e.target.value)}
						placeholder="Enter text..."
						className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
						autoFocus
					/>
				</div>
				<div className="flex gap-3">
					<button
						onClick={() => {
							if (textValue.trim()) {
								console.log("Applying text for field:", field.id, "Value:", textValue.trim());
								onSignatureComplete(field.id, textValue.trim());
							}
						}}
						disabled={!textValue.trim()}
						className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
					>
						Apply Text
					</button>
					<button
						onClick={onClose}
						className="px-4 py-2 bg-gray-300 hover:bg-gray-400 text-gray-700 rounded-lg font-medium transition-colors"
					>
						Cancel
					</button>
				</div>
			</div>
		);
	};

	if (field.type === "date") {
		return (
			<div className={`bg-white rounded-lg shadow-lg p-6 ${className}`}>
				<div className="flex items-center gap-2 mb-4">
					{getFieldIcon()}
					<h3 className="text-lg font-semibold text-gray-900">{getFieldLabel()}</h3>
				</div>
				{renderDateField()}
			</div>
		);
	}

	if (field.type === "text") {
		return (
			<div className={`bg-white rounded-lg shadow-lg p-6 ${className}`}>
				<div className="flex items-center gap-2 mb-4">
					{getFieldIcon()}
					<h3 className="text-lg font-semibold text-gray-900">{getFieldLabel()}</h3>
				</div>
				{renderTextField()}
			</div>
		);
	}

	// Signature and Initial fields - DRAW OR TYPE
	return (
		<div className={`bg-white rounded-lg shadow-lg p-6 ${className}`} style={{ color: "#1f2937" }}>
			<div className="flex items-center justify-between mb-4">
				<div className="flex items-center gap-2">
					{getFieldIcon()}
					<h3 className="text-lg font-semibold text-gray-900" style={{ color: "#111827" }}>
						Add your {getFieldLabel()}
					</h3>
				</div>
				<button
					onClick={onClose}
					className="text-gray-400 hover:text-gray-600 transition-colors text-2xl font-bold"
					style={{ color: "#9ca3af" }}
				>
					×
				</button>
			</div>

			{/* Mode Tabs */}
			<div className="flex gap-2 mb-4 border-b border-gray-200">
				<button
					onClick={() => setSignatureMode("draw")}
					className={`flex items-center gap-2 px-4 py-2 font-medium transition-colors border-b-2 ${
						signatureMode === "draw"
							? "border-blue-600 text-blue-600"
							: "border-transparent text-gray-500 hover:text-gray-700"
					}`}
					style={{ color: signatureMode === "draw" ? "#2563eb" : "#6b7280" }}
				>
					<PenTool className="h-4 w-4" />
					Draw
				</button>
				<button
					onClick={() => setSignatureMode("type")}
					className={`flex items-center gap-2 px-4 py-2 font-medium transition-colors border-b-2 ${
						signatureMode === "type"
							? "border-blue-600 text-blue-600"
							: "border-transparent text-gray-500 hover:text-gray-700"
					}`}
					style={{ color: signatureMode === "type" ? "#2563eb" : "#6b7280" }}
				>
					<svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							strokeLinecap="round"
							strokeLinejoin="round"
							strokeWidth={2}
							d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
						/>
					</svg>
					Type
				</button>
			</div>

			{/* Draw Mode */}
			{signatureMode === "draw" && (
				<div className="space-y-4">
					<div className="border-2 border-gray-300 rounded-lg bg-white overflow-hidden">
						<canvas
							ref={canvasRef}
							width={600}
							height={200}
							className="w-full cursor-crosshair"
							style={{ touchAction: "none" }}
							onMouseDown={startDrawing}
							onMouseMove={draw}
							onMouseUp={stopDrawing}
							onMouseLeave={stopDrawing}
						/>
					</div>
					<p className="text-xs text-gray-500 text-center" style={{ color: "#6b7280" }}>
						Draw your {field.type} in the box above using your mouse or touch
					</p>
				</div>
			)}

			{/* Type Mode */}
			{signatureMode === "type" && (
				<div className="space-y-4">
					<div>
						<label
							className="block text-sm font-medium text-gray-700 mb-2"
							style={{ color: "#374151" }}
						>
							Type your {field.type}:
						</label>
						<input
							type="text"
							value={textValue}
							onChange={(e) => setTextValue(e.target.value)}
							placeholder={field.type === "signature" ? "Your full name" : "Your initials"}
							className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg"
							style={{ color: "#111827" }}
							autoFocus
						/>
					</div>

					{/* Font Selector */}
					<div>
						<label
							className="block text-sm font-medium text-gray-700 mb-2"
							style={{ color: "#374151" }}
						>
							Choose a signature style:
						</label>
						<div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto">
							{SIGNATURE_FONTS.map((font) => (
								<button
									key={font.id}
									onClick={() => setSelectedFontId(font.id)}
									className={`p-3 border-2 rounded-lg transition-all text-left ${
										selectedFontId === font.id
											? "border-blue-600 bg-blue-50 shadow-md"
											: "border-gray-200 hover:border-gray-300 hover:shadow"
									}`}
								>
									<p
										className="text-2xl truncate"
										style={{
											fontFamily: font.fontFamily,
											color: "#1f2937",
										}}
									>
										{textValue || (field.type === "signature" ? "Your Signature" : "YI")}
									</p>
									<p className="text-xs text-gray-500 mt-1" style={{ color: "#6b7280" }}>
										{font.name}
									</p>
								</button>
							))}
						</div>
					</div>

					{/* Preview */}
					{textValue && (
						<div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
							<p className="text-xs text-gray-500 mb-2" style={{ color: "#6b7280" }}>
								Preview:
							</p>
							<p
								className="text-3xl text-center"
								style={{
									fontFamily: SIGNATURE_FONTS.find((f) => f.id === selectedFontId)?.fontFamily,
									color: "#111827",
								}}
							>
								{textValue}
							</p>
						</div>
					)}
				</div>
			)}

			{/* Action Buttons */}
			<div className="flex gap-3 mt-6">
				<button
					onClick={handleClearSignature}
					className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors"
					style={{ color: "#374151" }}
				>
					<Trash2 className="h-4 w-4" />
					Clear
				</button>
				<button
					onClick={handleSaveSignature}
					disabled={signatureMode === "draw" ? !hasDrawing : !textValue.trim()}
					className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
					style={{ color: "#ffffff" }}
				>
					<Save className="h-4 w-4" />
					Apply {getFieldLabel()}
				</button>
			</div>
		</div>
	);
};
