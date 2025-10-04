"use client";

import React, { useRef, useEffect, useState } from "react";
import { pdfjs } from "react-pdf";

// Set up PDF.js worker only on client side
if (typeof window !== "undefined") {
	pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;
}

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
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const renderTaskRef = useRef<{ cancel: () => void; promise: Promise<void> } | null>(null);
	const [isClient, setIsClient] = useState(false);

	// Ensure component only renders on client side
	useEffect(() => {
		setIsClient(true);
	}, []);

	useEffect(() => {
		if (!isClient) return;
		let isMounted = true;
		let pdfDoc: unknown = null;

		const renderPage = async () => {
			if (!canvasRef.current || !pdfUrl) {
				console.warn("[PDFPageCanvas] Missing canvas or PDF URL:", { canvasRef: !!canvasRef.current, pdfUrl });
				return;
			}

			try {
				console.log("[PDFPageCanvas] Loading PDF from:", pdfUrl);
				
				// Cancel any ongoing render task
				if (renderTaskRef.current) {
					renderTaskRef.current.cancel();
					renderTaskRef.current = null;
				}

				// Load the PDF document
				const loadingTask = pdfjs.getDocument(pdfUrl);
				pdfDoc = await loadingTask.promise;

				console.log("[PDFPageCanvas] PDF loaded successfully, rendering page:", pageNumber);

				if (!isMounted || !pdfDoc) return;

				// Get the specified page
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				const page = await (pdfDoc as any).getPage(pageNumber);

				if (!isMounted) return;

				// Get viewport with scale and rotation
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				const viewport = (page as any).getViewport({ scale: zoom, rotation });

				// Set canvas dimensions
				const canvas = canvasRef.current;
				const context = canvas.getContext("2d");
				if (!context) return;

				canvas.width = viewport.width;
				canvas.height = viewport.height;

				// Call onPageLoad with dimensions
				if (onPageLoad) {
					onPageLoad(viewport.width, viewport.height);
				}

				// Render the page
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				renderTaskRef.current = (page as any).render({
					canvasContext: context,
					viewport: viewport,
				});

				if (renderTaskRef.current) {
					await renderTaskRef.current.promise;
					renderTaskRef.current = null;
				}
			} catch (error: unknown) {
				if (
					error &&
					typeof error === "object" &&
					"name" in error &&
					error.name === "RenderingCancelledException"
				) {
					// Rendering was cancelled, ignore
					return;
				}
				console.error("Error rendering PDF page:", error);
			}
		};

		renderPage();

		return () => {
			isMounted = false;
			if (renderTaskRef.current) {
				renderTaskRef.current.cancel();
			}
			if (
				pdfDoc &&
				typeof pdfDoc === "object" &&
				"destroy" in pdfDoc &&
				typeof (pdfDoc as { destroy: () => void }).destroy === "function"
			) {
				(pdfDoc as { destroy: () => void }).destroy();
			}
		};
	}, [pdfUrl, pageNumber, zoom, rotation, onPageLoad, isClient]);

	// Don't render canvas during SSR
	if (!isClient) {
		return <div className={className} style={{ minHeight: "600px", background: "#f3f4f6" }} />;
	}

	return (
		<canvas
			ref={canvasRef}
			className={className}
			style={{ display: "block", width: "100%", height: "auto" }}
		/>
	);
};
