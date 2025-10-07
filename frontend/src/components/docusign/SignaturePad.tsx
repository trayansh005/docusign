"use client";

import React, { useRef, useState } from "react";
import { PenTool, Trash2, Save, Type, Calendar, FileSignature } from "lucide-react";
import SignatureCanvas from "react-signature-canvas";
import { SignatureField } from "@/types/docusign";
import { SIGNATURE_FONTS } from "@/constants/signatureFonts";

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
	const sigCanvas = useRef<SignatureCanvas>(null);

	const [signatureMode, setSignatureMode] = useState<"draw" | "type">("draw");
	const [typedSignature, setTypedSignature] = useState<string>("");
	const [selectedFontId, setSelectedFontId] = useState<string>(SIGNATURE_FONTS[0].id);
	const [textValue, setTextValue] = useState<string>("");

	const handleClearSignature = () => {
		if (sigCanvas.current) {
			sigCanvas.current.clear();
		}

		setTypedSignature("");
	};

	const handleSaveSignature = () => {
		let finalSignatureData = "";

		if (signatureMode === "draw") {
			if (sigCanvas.current && !sigCanvas.current.isEmpty()) {
				finalSignatureData = sigCanvas.current.toDataURL("image/png", 0.8);
			}
		} else if (signatureMode === "type" && typedSignature.trim()) {
			// Create a canvas for typed signature
			const canvas = document.createElement("canvas");
			const ctx = canvas.getContext("2d");
			if (ctx) {
				canvas.width = 400;
				canvas.height = 100;

				// Set background
				ctx.fillStyle = "white";
				ctx.fillRect(0, 0, canvas.width, canvas.height);

				// Set font based on selection
				const selectedFont = SIGNATURE_FONTS.find((f) => f.id === selectedFontId);
				const fontFamily = selectedFont?.fontFamily || SIGNATURE_FONTS[0].fontFamily;
				const fontSize = 36;

				ctx.font = `${fontSize}px ${fontFamily}`;
				ctx.fillStyle = "black";
				ctx.textAlign = "center";
				ctx.textBaseline = "middle";

				// Draw the text
				ctx.fillText(typedSignature.trim(), canvas.width / 2, canvas.height / 2);

				finalSignatureData = canvas.toDataURL("image/png", 0.8);
			}
		}

		if (finalSignatureData) {
			onSignatureComplete(field.id, finalSignatureData);
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
				return <Type className="h-4 w-4" />;
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
					<p className="text-sm text-gray-200 mt-2">Current date will be applied</p>
				</div>
				<div className="flex gap-3">
					<button
						onClick={() => onSignatureComplete(field.id, today)}
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
						onClick={() => textValue.trim() && onSignatureComplete(field.id, textValue.trim())}
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

	// Signature and Initial fields
	return (
		<div className={`bg-white rounded-lg shadow-lg p-6 ${className}`}>
			<div className="flex items-center justify-between mb-4">
				<div className="flex items-center gap-2">
					{getFieldIcon()}
					<h3 className="text-lg font-semibold text-gray-900">{getFieldLabel()}</h3>
				</div>
				<button onClick={onClose} className="text-gray-300 hover:text-white transition-colors">
					×
				</button>
			</div>

			{/* Mode Selection */}
			<div className="flex gap-2 mb-4">
				<button
					onClick={() => setSignatureMode("draw")}
					className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
						signatureMode === "draw"
							? "bg-blue-100 text-blue-700 border border-blue-300"
							: "bg-gray-100 text-gray-600 hover:bg-gray-200"
					}`}
				>
					<PenTool className="h-4 w-4" />
					Draw
				</button>
				<button
					onClick={() => setSignatureMode("type")}
					className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
						signatureMode === "type"
							? "bg-blue-100 text-blue-700 border border-blue-300"
							: "bg-gray-100 text-gray-600 hover:bg-gray-200"
					}`}
				>
					<Type className="h-4 w-4" />
					Type
				</button>
			</div>

			{signatureMode === "draw" ? (
				<div className="space-y-4">
					<div className="border-2 border-gray-300 rounded-lg bg-white">
						<SignatureCanvas
							ref={sigCanvas}
							canvasProps={{
								width: 400,
								height: 150,
								className: "signature-canvas rounded-lg",
								style: { width: "100%", height: "150px" },
							}}
							backgroundColor="white"
							penColor="black"
							minWidth={1}
							maxWidth={3}
						/>
					</div>
					<p className="text-xs text-gray-200 text-center">
						Draw your {field.type} in the box above
					</p>
				</div>
			) : (
				<div className="space-y-4">
					<div>
						<input
							type="text"
							value={typedSignature}
							onChange={(e) => setTypedSignature(e.target.value)}
							placeholder={`Type your ${field.type}...`}
							className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
							autoFocus
						/>
					</div>

					{/* Font Selection */}
					<div>
						<label className="block text-sm font-medium text-gray-700 mb-2">
							Choose font style:
						</label>
						<div className="grid grid-cols-2 gap-2">
							{SIGNATURE_FONTS.map((font) => (
								<button
									key={font.id}
									onClick={() => setSelectedFontId(font.id)}
									className={`p-3 text-left border rounded-lg transition-colors ${
										selectedFontId === font.id
											? "border-blue-500 bg-blue-50"
											: "border-gray-300 hover:border-gray-400"
									}`}
								>
									<div style={{ fontFamily: font.fontFamily }} className="text-lg">
										{typedSignature || font.name}
									</div>
								</button>
							))}
						</div>
					</div>

					{/* Preview */}
					{typedSignature && (
						<div className="p-4 bg-gray-50 rounded-lg border">
							<p className="text-sm text-gray-600 mb-2">Preview:</p>
							<div
								style={{
									fontFamily:
										SIGNATURE_FONTS.find((f) => f.id === selectedFontId)?.fontFamily ||
										SIGNATURE_FONTS[0].fontFamily,
									fontSize: "24px",
									textAlign: "center",
								}}
							>
								{typedSignature}
							</div>
						</div>
					)}
				</div>
			)}

			{/* Action Buttons */}
			<div className="flex gap-3 mt-6">
				<button
					onClick={handleClearSignature}
					className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors"
				>
					<Trash2 className="h-4 w-4" />
					Clear
				</button>
				<button
					onClick={handleSaveSignature}
					disabled={
						signatureMode === "draw"
							? !sigCanvas.current || sigCanvas.current.isEmpty()
							: !typedSignature.trim()
					}
					className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
				>
					<Save className="h-4 w-4" />
					Apply {getFieldLabel()}
				</button>
			</div>
		</div>
	);
};
