"use client";

import React, { useState, useMemo } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

// Set up PDF.js worker using CDN (reliable for Next.js/Turbopack)
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

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
	const [pageWidth, setPageWidth] = useState<number | undefined>(undefined);
	const containerRef = React.useRef<HTMLDivElement>(null);

	// Memoize the file object to prevent unnecessary reloads
	const fileObject = useMemo(() => ({ url: pdfUrl }), [pdfUrl]);

	React.useEffect(() => {
		const updateWidth = () => {
			if (containerRef.current) {
				// Use full container width for responsive display
				const containerWidth = containerRef.current.offsetWidth;
				setPageWidth(containerWidth > 0 ? containerWidth : 800);
			}
		};

		updateWidth();
		window.addEventListener("resize", updateWidth);
		return () => window.removeEventListener("resize", updateWidth);
	}, []);

	const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
		console.log("[PDFPageCanvas] PDF loaded successfully, total pages:", numPages);
	};

	const onPageLoadSuccess = (page: { width: number; height: number }) => {
		const { width, height } = page;
		if (onPageLoad) {
			onPageLoad(width, height);
		}
		console.log("[PDFPageCanvas] Page loaded:", { width, height, page: pageNumber });
	};

	console.log("[PDFPageCanvas] Rendering PDF from:", pdfUrl, "page:", pageNumber);

	// Handle empty or invalid PDF URL
	if (!pdfUrl || pdfUrl.trim() === '') {
		return (
			<div className={className} style={{ width: "100%", maxWidth: "1200px" }}>
				<div className="flex items-center justify-center p-8 min-h-[600px] bg-red-900/20 border border-red-500/30 rounded-lg">
					<div className="text-red-400 font-medium">
						No PDF URL provided. Please re-upload the document.
					</div>
				</div>
			</div>
		);
	}

	return (
		<div ref={containerRef} className={className} style={{ width: "100%", height: "100%" }}>
			<Document
				file={fileObject}
				onLoadSuccess={onDocumentLoadSuccess}
				onLoadError={(error) => {
					console.error("[PDFPageCanvas] Failed to load PDF:", error);
					console.error("[PDFPageCanvas] PDF URL was:", pdfUrl);
				}}
				loading={
					<div className="flex items-center justify-center p-8 min-h-[600px] bg-gray-800/50 rounded-lg">
						<div className="text-white font-medium">Loading PDF...</div>
					</div>
				}
				error={
					<div className="flex items-center justify-center p-8 min-h-[600px] bg-red-900/20 border border-red-500/30 rounded-lg">
						<div className="text-red-400 font-medium">
							Failed to load PDF. Please check the file path.
						</div>
					</div>
				}
			>
				{pageWidth && (
					<Page
						pageNumber={pageNumber}
						width={pageWidth}
						rotate={rotation}
						scale={zoom}
						onLoadSuccess={onPageLoadSuccess}
						loading={
							<div className="flex items-center justify-center p-8 min-h-[400px] bg-gray-800/50 rounded-lg">
								<div className="text-white font-medium">Loading page {pageNumber}...</div>
							</div>
						}
						className="bg-white"
					/>
				)}
			</Document>
		</div>
	);
};
