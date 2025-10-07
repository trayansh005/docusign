"use client";

import React, { useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { CheckCircle } from "lucide-react";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

// Set up PDF.js worker using CDN (reliable for Next.js/Turbopack)
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface SignedDocumentViewerProps {
	pdfUrl: string;
	onBack: () => void;
}

export const SignedDocumentViewer: React.FC<SignedDocumentViewerProps> = ({ pdfUrl, onBack }) => {
	const [numPages, setNumPages] = useState<number | null>(null);
	const [pageNumber, setPageNumber] = useState(1);

	const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
		setNumPages(numPages);
		setPageNumber(1);
	};

	return (
		<div className="max-w-6xl mx-auto">
			<div className="bg-white rounded-lg shadow-xl overflow-hidden">
				{/* Success Header */}
				<div className="bg-gradient-to-r from-green-600 to-green-700 p-6">
					<div className="flex items-start gap-4">
						<CheckCircle className="h-10 w-10 text-white mt-1 flex-shrink-0" />
						<div className="flex-1">
							<h2 className="text-3xl font-bold text-white mb-2">
								Signed document generated successfully
							</h2>
							<p className="text-white/95">
								Your final PDF with signatures is ready. You can open it in a new tab, download it,
								or view the preview below.
							</p>
						</div>
					</div>

					{/* Action Buttons */}
					<div className="flex items-center gap-3 mt-6 flex-wrap">
						<a
							className="inline-flex items-center rounded-md bg-white px-5 py-2.5 text-sm font-semibold text-green-700 hover:bg-gray-50 shadow-md transition-colors"
							href={pdfUrl}
							target="_blank"
							rel="noreferrer"
						>
							Open Final PDF
						</a>
						<a
							className="inline-flex items-center rounded-md border-2 border-white bg-transparent px-5 py-2.5 text-sm font-semibold text-white hover:bg-white/20 transition-colors"
							href={pdfUrl}
							download
						>
							Download
						</a>
						<button
							onClick={onBack}
							className="inline-flex items-center rounded-md border-2 border-white bg-transparent px-5 py-2.5 text-sm font-semibold text-white hover:bg-white/20 transition-colors"
						>
							Back to Templates
						</button>
					</div>
				</div>

				{/* PDF Viewer */}
				<div className="bg-gray-100 p-6">
					<div className="bg-white rounded-lg shadow-inner p-4">
						<div className="flex items-center justify-between mb-4 pb-3 border-b">
							<h3 className="text-lg font-semibold text-gray-800">PDF Preview</h3>
							{numPages && (
								<div className="flex items-center gap-3">
									<button
										onClick={() => setPageNumber((prev) => Math.max(1, prev - 1))}
										disabled={pageNumber === 1}
										className="px-3 py-1.5 text-sm font-medium rounded bg-gray-200 hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed text-gray-700"
									>
										Previous
									</button>
									<span className="text-sm text-gray-600 font-medium">
										Page {pageNumber} of {numPages}
									</span>
									<button
										onClick={() => setPageNumber((prev) => Math.min(numPages, prev + 1))}
										disabled={pageNumber === numPages}
										className="px-3 py-1.5 text-sm font-medium rounded bg-gray-200 hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed text-gray-700"
									>
										Next
									</button>
								</div>
							)}
						</div>

						<div className="flex justify-center bg-gray-50 rounded p-4 min-h-[600px]">
							<Document
								file={pdfUrl}
								onLoadSuccess={onDocumentLoadSuccess}
								loading={
									<div className="flex items-center justify-center p-8">
										<div className="text-gray-500">Loading PDF...</div>
									</div>
								}
								error={
									<div className="flex flex-col items-center justify-center p-8 text-red-600">
										<p className="font-semibold mb-2">Failed to load PDF</p>
										<p className="text-sm text-gray-600">
											Please try opening it in a new tab using the button above.
										</p>
									</div>
								}
							>
								<Page
									pageNumber={pageNumber}
									width={800}
									renderTextLayer={true}
									renderAnnotationLayer={true}
									className="shadow-lg"
								/>
							</Document>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
};
