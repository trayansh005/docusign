"use client";

import { useState, useRef, useEffect } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

// Set up the worker: use a CDN-hosted minified worker which is compatible with Next.js/webpack bundlers.
// Using the .js worker from a CDN avoids issues with ESM `.mjs` worker paths in some bundlers.
if (typeof window !== "undefined" && !pdfjs.GlobalWorkerOptions.workerSrc) {
	pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;
}

interface PDFThumbnailProps {
	pdfUrl: string;
	pageNumber: number;
	isActive?: boolean;
	onClick?: () => void;
}

export function PDFThumbnail({ pdfUrl, pageNumber, isActive = false, onClick }: PDFThumbnailProps) {
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState(false);
	const [containerWidth, setContainerWidth] = useState(0);
	const containerRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (containerRef.current) {
			setContainerWidth(containerRef.current.offsetWidth);
		}
	}, []);

	return (
		<div
			onClick={onClick}
			className={`border-2 rounded-lg p-2 cursor-pointer transition-all ${
				isActive
					? "border-blue-500 bg-blue-50 shadow-md ring-2 ring-blue-200"
					: "border-gray-300 hover:border-blue-400 hover:shadow-sm"
			}`}
		>
			<div
				ref={containerRef}
				className="aspect-[8.5/11] bg-white rounded overflow-hidden relative shadow-sm"
			>
				{isLoading && !error && (
					<div className="absolute inset-0 flex items-center justify-center bg-gray-100 z-10">
						<div className="flex flex-col items-center gap-2">
							<div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
							<span className="text-xs text-gray-400">Loading...</span>
						</div>
					</div>
				)}
				{error ? (
					<div className="absolute inset-0 flex items-center justify-center bg-gray-100">
						<div className="text-center">
							<span className="text-xs text-red-400">Error</span>
							<div className="text-xs text-gray-400 mt-1">Page {pageNumber}</div>
						</div>
					</div>
				) : (
					<div className="w-full h-full flex items-center justify-center">
						<Document
							file={pdfUrl}
							loading={null}
							error={null}
							onLoadError={() => setError(true)}
							className="w-full h-full"
						>
							<Page
								pageNumber={pageNumber}
								width={containerWidth || 150}
								renderTextLayer={false}
								renderAnnotationLayer={false}
								loading={null}
								onLoadSuccess={() => setIsLoading(false)}
								onLoadError={() => setError(true)}
								className="w-full h-full"
							/>
						</Document>
					</div>
				)}
			</div>
			<div
				className={`text-xs text-center mt-2 font-medium ${
					isActive ? "text-blue-600" : "text-gray-600"
				}`}
			>
				Page {pageNumber}
			</div>
		</div>
	);
}
