"use client";

import React, { useState, useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Upload, FileText, AlertCircle, CheckCircle } from "lucide-react";
import { uploadDocument } from "@/services/docusignAPI";
import { DocuSignTemplateData } from "@/types/docusign";

interface DocumentUploadProps {
	onUploadSuccess?: (template: DocuSignTemplateData) => void;
	className?: string;
}

export const DocumentUpload: React.FC<DocumentUploadProps> = ({
	onUploadSuccess,
	className = "",
}) => {
	const [isDragOver, setIsDragOver] = useState(false);
	const [limitError, setLimitError] = useState<string | null>(null);
	const queryClient = useQueryClient();

	const uploadMutation = useMutation({
		mutationFn: async (file: File) => {
			return uploadDocument(file);
		},
		onSuccess: (data) => {
			setLimitError(null);
			queryClient.invalidateQueries({ queryKey: ["docusign-templates"] });
			onUploadSuccess?.(data);
		},
		onError: (err: unknown) => {
			console.log(
				"Upload error:",
				err,
				"Type:",
				typeof err,
				"instanceof Error:",
				err instanceof Error
			);
			if (err instanceof Error) {
				console.log("Error message:", err.message);
				console.log("Error keys:", Object.keys(err));
				console.log("Error code property:", (err as unknown as Record<string, unknown>).code);
			}

			// Check if this is a free plan limit error
			if (err instanceof Error) {
				// Check for code in new error message format
				// Format: "ERROR:CODE:message"
				const match = err.message.match(/^ERROR:([A-Z_]+):/);
				if (match && match[1] === "FREE_LIMIT_REACHED") {
					console.log("[PDFUpload] Free limit error detected from message");
					setLimitError("Free plan limit reached. Please upgrade to upload more documents.");
					return;
				}

				// Check for code property first (might work in dev)
				const codeProperty = (err as unknown as Record<string, unknown>).code;
				if (codeProperty === "FREE_LIMIT_REACHED") {
					console.log("[PDFUpload] Free limit error detected from code property");
					setLimitError("Free plan limit reached. Please upgrade to upload more documents.");
					return;
				}

				// Check for code in error message (survives production serialization)
				// Error message format: "[FREE_LIMIT_REACHED] message text"
				const codeMatch = err.message.match(/^\[([A-Z_]+)\]/);
				if (codeMatch && codeMatch[1] === "FREE_LIMIT_REACHED") {
					console.log("[PDFUpload] Free limit error detected from bracket format");
					setLimitError("Free plan limit reached. Please upgrade to upload more documents.");
					return;
				}

				// Fallback: check message content
				if (err.message?.includes("Free plan limit")) {
					console.log("[PDFUpload] Free limit error detected from message content");
					setLimitError("Free plan limit reached. Please upgrade to upload more documents.");
					return;
				}
			}

			// Not a limit error, clear it
			setLimitError(null);
		},
	});

	const handleDragOver = useCallback((e: React.DragEvent) => {
		e.preventDefault();
		setIsDragOver(true);
	}, []);

	const handleDragLeave = useCallback((e: React.DragEvent) => {
		e.preventDefault();
		setIsDragOver(false);
	}, []);

	const isValidFileType = (file: File) => {
		const allowedTypes = [
			"application/pdf",
			"application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
			"application/msword", // .doc
		];
		return allowedTypes.includes(file.type);
	};

	const handleDrop = useCallback(
		(e: React.DragEvent) => {
			e.preventDefault();
			setIsDragOver(false);

			const files = Array.from(e.dataTransfer.files);
			const validFile = files.find((file) => isValidFileType(file));

			if (validFile) {
				uploadMutation.mutate(validFile);
			}
		},
		[uploadMutation]
	);

	const handleFileSelect = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			const file = e.target.files?.[0];
			if (file && isValidFileType(file)) {
				uploadMutation.mutate(file);
			}
		},
		[uploadMutation]
	);

	return (
		<div className={`w-full ${className}`}>
			<div
				className={`
          relative border-2 border-dashed rounded-lg p-8 text-center transition-colors
          ${isDragOver ? "border-blue-500 bg-blue-900/20" : "border-gray-600 hover:border-gray-500"}
          ${uploadMutation.isPending ? "pointer-events-none opacity-50" : "cursor-pointer"}
        `}
				onDragOver={handleDragOver}
				onDragLeave={handleDragLeave}
				onDrop={handleDrop}
				onClick={() =>
					!uploadMutation.isPending && document.getElementById("document-upload")?.click()
				}
			>
				<input
					id="document-upload"
					type="file"
					accept=".pdf,.docx,.doc"
					onChange={handleFileSelect}
					className="hidden"
					disabled={uploadMutation.isPending}
				/>

				<div className="flex flex-col items-center space-y-4">
					{uploadMutation.isPending ? (
						<>
							<div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
							<div className="text-lg font-medium text-white">Processing Document...</div>
							<div className="text-sm text-gray-200">Converting to images and extracting pages</div>
						</>
					) : uploadMutation.isSuccess ? (
						<>
							<CheckCircle className="h-12 w-12 text-green-500" />
							<div className="text-lg font-medium text-green-400">
								Document Uploaded Successfully
							</div>
							<div className="text-sm text-gray-200">
								Template created and ready for signature fields
							</div>
						</>
					) : uploadMutation.isError ? (
						<>
							<AlertCircle className="h-12 w-12 text-red-500" />
							<div className="text-lg font-medium text-red-400">Upload Failed</div>
							{limitError ? (
								<div className="text-sm text-gray-200 text-center">{limitError}</div>
							) : (
								<div className="text-sm text-gray-200">
									Please try again with a valid document file
								</div>
							)}
							{limitError && (
								<a
									href="/subscription"
									className="mt-3 inline-flex items-center px-4 py-2 rounded bg-blue-600 hover:bg-blue-500 text-white text-sm"
								>
									Upgrade plan
								</a>
							)}
						</>
					) : (
						<>
							<Upload className="h-12 w-12 text-gray-300" />
							<div className="text-lg font-medium text-white">Upload Document</div>
							<div className="text-sm text-gray-200">
								Drag and drop a PDF or Word document here, or click to select
							</div>
							<div className="text-xs text-gray-300">Supports PDF, DOCX, and DOC files</div>
						</>
					)}
				</div>
			</div>

			{uploadMutation.isSuccess && (
				<div className="mt-4 p-4 bg-green-900/20 border border-green-600/50 rounded-lg">
					<div className="flex items-center space-x-2">
						<FileText className="h-5 w-5 text-green-400" />
						<div className="text-sm text-green-200">
							<strong>Template Created:</strong> {uploadMutation.data?.metadata.filename}
						</div>
					</div>
					<div className="mt-2 text-xs text-green-300">
						Pages: {uploadMutation.data?.numPages} | Size:{" "}
						{(uploadMutation.data?.metadata.fileSize / 1024 / 1024).toFixed(2)} MB
					</div>
				</div>
			)}

			{limitError && !uploadMutation.isPending && !uploadMutation.isSuccess && (
				<div className="mt-4 p-4 bg-yellow-900/20 border border-yellow-600/50 rounded-lg">
					<div className="flex items-center justify-between">
						<div className="text-sm text-yellow-200">{limitError}</div>
						<a
							href="/subscription"
							className="inline-flex items-center px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white text-xs"
						>
							See plans
						</a>
					</div>
				</div>
			)}
		</div>
	);
};

// Keep the old component name for backward compatibility
export const PDFUpload = DocumentUpload;
