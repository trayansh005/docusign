"use client";

import React, { useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

// Set up PDF.js worker - same as RCSS project
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
	"pdfjs-dist/build/pdf.worker.min.mjs",
	import.meta.url
).toString();

interface PDFPageCanvasProps {
	pdfUrl: string;
	pageNumber: number;
	zoom: number;
	rotation: number;
	onPageLoad?: (width: number, height: number) => void;
	className?: string;
}

export const PDFPageCanvas: React.FC<PDFPageCanvasProps> = ({
	pdfUrl,
	pageNumber,
	zoom,
	rotation,
	onPageLoad,
	className = "",
}) => {
	const [pageWidth, setPageWidth] = useState(800);

	const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
		console.log("[PDFPageCanvas] PDF loaded successfully, total pages:", numPages);
	};

	const onPageLoadSuccess = (page: { width: number; height: number }) => {
		const { width, height } = page;
		setPageWidth(width);
		if (onPageLoad) {
			onPageLoad(width, height);
		}
		console.log("[PDFPageCanvas] Page loaded:", { width, height, page: pageNumber });
	};

	console.log("[PDFPageCanvas] Rendering PDF from:", pdfUrl, "page:", pageNumber);

	return (
		<div className={className}>
			<Document
				file={{ url: pdfUrl }}
				onLoadSuccess={onDocumentLoadSuccess}
				onLoadError={(error) => {
					console.error("[PDFPageCanvas] Failed to load PDF:", error);
					console.error("[PDFPageCanvas] PDF URL was:", pdfUrl);
				}}
				loading={
					<div className="flex items-center justify-center p-8 min-h-[600px] bg-gray-100">
						<div className="text-gray-600">Loading PDF...</div>
					</div>
				}
				error={
					<div className="flex items-center justify-center p-8 min-h-[600px] bg-red-50">
						<div className="text-red-600">Failed to load PDF. Please check the file path.</div>
					</div>
				}
			>
				<Page
					pageNumber={pageNumber}
					width={pageWidth}
					rotate={rotation}
					scale={zoom}
					onLoadSuccess={onPageLoadSuccess}
					loading={
						<div className="flex items-center justify-center p-8 min-h-[400px] bg-gray-50">
							<div className="text-gray-600">Loading page {pageNumber}...</div>
						</div>
					}
					className="border shadow-lg bg-white"
				/>
			</Document>
		</div>
	);
};
