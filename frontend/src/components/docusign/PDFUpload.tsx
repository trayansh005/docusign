"use client";

import React, { useState, useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Upload, FileText, AlertCircle, CheckCircle } from "lucide-react";
import { uploadPDF } from "@/services/docusignAPI";
import { DocuSignTemplateData } from "@/types/docusign";

interface PDFUploadProps {
	onUploadSuccess?: (template: DocuSignTemplateData) => void;
	className?: string;
}

export const PDFUpload: React.FC<PDFUploadProps> = ({ onUploadSuccess, className = "" }) => {
	const [isDragOver, setIsDragOver] = useState(false);
	const queryClient = useQueryClient();

	const uploadMutation = useMutation({
		mutationFn: async (file: File) => {
			return uploadPDF(file);
		},
		onSuccess: (data) => {
			queryClient.invalidateQueries({ queryKey: ["docusign-templates"] });
			onUploadSuccess?.(data);
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

	const handleDrop = useCallback(
		(e: React.DragEvent) => {
			e.preventDefault();
			setIsDragOver(false);

			const files = Array.from(e.dataTransfer.files);
			const pdfFile = files.find((file) => file.type === "application/pdf");

			if (pdfFile) {
				uploadMutation.mutate(pdfFile);
			}
		},
		[uploadMutation]
	);

	const handleFileSelect = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			const file = e.target.files?.[0];
			if (file && file.type === "application/pdf") {
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
				onClick={() => !uploadMutation.isPending && document.getElementById("pdf-upload")?.click()}
			>
				<input
					id="pdf-upload"
					type="file"
					accept=".pdf"
					onChange={handleFileSelect}
					className="hidden"
					disabled={uploadMutation.isPending}
				/>

				<div className="flex flex-col items-center space-y-4">
					{uploadMutation.isPending ? (
						<>
							<div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
							<div className="text-lg font-medium text-white">Processing PDF...</div>
							<div className="text-sm text-gray-200">Converting to images and extracting pages</div>
						</>
					) : uploadMutation.isSuccess ? (
						<>
							<CheckCircle className="h-12 w-12 text-green-500" />
							<div className="text-lg font-medium text-green-400">PDF Uploaded Successfully</div>
							<div className="text-sm text-gray-200">
								Template created and ready for signature fields
							</div>
						</>
					) : uploadMutation.isError ? (
						<>
							<AlertCircle className="h-12 w-12 text-red-500" />
							<div className="text-lg font-medium text-red-400">Upload Failed</div>
							<div className="text-sm text-gray-200">Please try again with a valid PDF file</div>
						</>
					) : (
						<>
							<Upload className="h-12 w-12 text-gray-300" />
							<div className="text-lg font-medium text-white">Upload PDF Document</div>
							<div className="text-sm text-gray-200">
								Drag and drop a PDF file here, or click to select
							</div>
							<div className="text-xs text-gray-300">Only PDF files are supported</div>
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
		</div>
	);
};
