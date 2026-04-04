"use client";

import React, { useState, useEffect } from "react";
import mammoth from "mammoth";

interface WordDocumentViewerProps {
    wordDocUrl: string;
    onContentLoad?: (width: number, height: number) => void;
    className?: string;
}

export const WordDocumentViewer: React.FC<WordDocumentViewerProps> = ({
    wordDocUrl,
    onContentLoad,
    className = ""
}) => {
    const [htmlContent, setHtmlContent] = useState<string>("");
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const contentRef = React.useRef<HTMLDivElement>(null);

    useEffect(() => {
        const loadWordDocument = async () => {
            try {
                setIsLoading(true);
                setError(null);

                console.log("[WordDocumentViewer] Loading Word document from:", wordDocUrl);

                // Fetch the Word document
                const response = await fetch(wordDocUrl);
                if (!response.ok) {
                    throw new Error(`Failed to fetch document: ${response.statusText}`);
                }

                // Get the document as an ArrayBuffer
                const arrayBuffer = await response.arrayBuffer();

                console.log("[WordDocumentViewer] Document fetched, converting to HTML...");

                // Convert Word document to HTML using mammoth
                const result = await mammoth.convertToHtml({ arrayBuffer });

                console.log("[WordDocumentViewer] Conversion complete");
                if (result.messages.length > 0) {
                    console.log("[WordDocumentViewer] Conversion messages:", result.messages);
                }

                setHtmlContent(result.value);
                setIsLoading(false);

                // Notify parent of content load after a short delay to let DOM update
                setTimeout(() => {
                    if (contentRef.current && onContentLoad) {
                        const rect = contentRef.current.getBoundingClientRect();
                        onContentLoad(rect.width, rect.height);
                    }
                }, 100);

            } catch (err) {
                console.error("[WordDocumentViewer] Error loading Word document:", err);
                setError(err instanceof Error ? err.message : "Failed to load document");
                setIsLoading(false);
            }
        };

        if (wordDocUrl) {
            loadWordDocument();
        }
    }, [wordDocUrl, onContentLoad]);

    if (isLoading) {
        return (
            <div className={`flex items-center justify-center p-8 min-h-[600px] bg-gray-100 rounded-lg ${className}`}>
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
                    <div className="text-gray-600">Loading Word document...</div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className={`flex items-center justify-center p-8 min-h-[600px] bg-red-50 border border-red-200 rounded-lg ${className}`}>
                <div className="text-center text-red-600">
                    <div className="font-medium text-lg mb-2">Failed to load document</div>
                    <div className="text-sm">{error}</div>
                </div>
            </div>
        );
    }

    return (
        <div
            ref={contentRef}
            className={`word-document-content bg-white p-8 rounded-lg shadow-sm ${className}`}
            style={{
                fontFamily: "'Times New Roman', 'Liberation Serif', serif",
                fontSize: '11pt',
                lineHeight: '1.15',
                width: '100%',
                maxWidth: '100%',
                wordWrap: 'break-word',
                overflowWrap: 'break-word',
                boxSizing: 'border-box'
            }}
        >
            <style jsx>{`
                .word-document-content {
                    overflow-x: auto;
                }
                .word-document-content :global(*) {
                    max-width: 100%;
                    box-sizing: border-box;
                }
                .word-document-content :global(p) {
                    margin: 0 0 6pt 0;
                    word-wrap: break-word;
                    overflow-wrap: break-word;
                }
                .word-document-content :global(h1),
                .word-document-content :global(h2),
                .word-document-content :global(h3),
                .word-document-content :global(h4),
                .word-document-content :global(h5),
                .word-document-content :global(h6) {
                    margin: 12pt 0 6pt 0;
                    font-weight: bold;
                    word-wrap: break-word;
                }
                .word-document-content :global(h1) { font-size: 16pt; }
                .word-document-content :global(h2) { font-size: 14pt; }
                .word-document-content :global(h3) { font-size: 12pt; }
                .word-document-content :global(table) {
                    border-collapse: collapse;
                    width: 100%;
                    margin: 6pt 0;
                    table-layout: fixed;
                }
                .word-document-content :global(td),
                .word-document-content :global(th) {
                    border: 1px solid #000;
                    padding: 4pt;
                    text-align: left;
                    word-wrap: break-word;
                    overflow-wrap: break-word;
                }
                .word-document-content :global(th) {
                    background-color: #f0f0f0;
                    font-weight: bold;
                }
                .word-document-content :global(ul),
                .word-document-content :global(ol) {
                    margin: 6pt 0;
                    padding-left: 24pt;
                }
                .word-document-content :global(li) {
                    margin: 3pt 0;
                    word-wrap: break-word;
                }
                .word-document-content :global(img) {
                    max-width: 100%;
                    height: auto;
                }
            `}</style>
            <div dangerouslySetInnerHTML={{ __html: htmlContent }} />
        </div>
    );
};