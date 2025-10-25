"use client";

import React, { useState, useRef, useCallback } from "react";
import { PenTool, ZoomIn, ZoomOut, RotateCw } from "lucide-react";
import { ensureAbsoluteUrl } from "@/lib/urlUtils";
import { DocuSignTemplateData, SignatureField } from "@/types/docusign";
import { useAuthStore } from "@/stores/authStore";
import { SignaturePad } from "./SignaturePad";
import { PDFPageCanvas } from "./PDFPageCanvas";
import { SigningProgress } from "./SigningProgress";

interface RecipientDocumentViewerProps {
    template: DocuSignTemplateData;
    onFieldUpdate?: (pageNumber: number, fieldId: string, patch: Partial<SignatureField>) => void;
    showSigningProgress?: boolean;
}

export const RecipientDocumentViewer: React.FC<RecipientDocumentViewerProps> = ({
    template,
    onFieldUpdate,
    showSigningProgress = true,
}) => {
    const user = useAuthStore((state) => state.user);
    const [currentPage, setCurrentPage] = useState(1);
    const [activeSignatureField, setActiveSignatureField] = useState<SignatureField | null>(null);
    const [zoom, setZoom] = useState(1);
    const [rotation, setRotation] = useState(0);
    const contentRef = useRef<HTMLDivElement>(null);

    // PDF controls
    const handleZoomIn = () => setZoom((prev) => Math.min(prev + 0.25, 3));
    const handleZoomOut = () => setZoom((prev) => Math.max(prev - 0.25, 0.25));
    const handleRotate = () => setRotation((prev) => (prev + 90) % 360);

    // Get fields that this recipient can fill
    const userId = (user as { id?: string })?.id || "";
    const userEmail = user?.email || "";

    const myFields = template.signatureFields?.filter((field) => {
        // Include fields assigned to this user
        if (field.recipientId === userEmail || field.recipientId === userId) return true;
        // Include placeholder fields that recipients can fill
        if (field.placeholder && field.recipientId === "placeholder") return true;
        return false;
    }) || [];

    // Debug field loading
    console.log("RecipientDocumentViewer - Fields debug:", {
        totalFields: template.signatureFields?.length || 0,
        myFields: myFields.length,
        allFields: template.signatureFields,
        userEmail,
        userId,
        sampleFieldPositions: myFields.slice(0, 3).map(f => ({
            id: f.id,
            xPct: f.xPct,
            yPct: f.yPct,
            wPct: f.wPct,
            hPct: f.hPct,
            placeholder: f.placeholder
        }))
    });

    // Get fields for current page
    const currentPageFields = myFields.filter((field) => field.pageNumber === currentPage);

    // Handle field click to open signature pad
    const handleFieldClick = useCallback((field: SignatureField) => {
        setActiveSignatureField(field);
    }, []);

    // Handle signature completion
    const handleSignatureComplete = useCallback(
        (fieldId: string, signatureData: string) => {
            if (onFieldUpdate) {
                const field = template.signatureFields.find(f => f.id === fieldId);

                // If it's a placeholder field, convert it to a regular field assigned to current user
                if (field?.placeholder && field.recipientId === "placeholder") {
                    onFieldUpdate(currentPage, fieldId, {
                        value: signatureData,
                        recipientId: userEmail || userId || "current-user",
                        placeholder: false,
                        placeholderText: undefined,
                    });
                } else {
                    onFieldUpdate(currentPage, fieldId, { value: signatureData });
                }
            }
            setActiveSignatureField(null);
        },
        [onFieldUpdate, currentPage, template.signatureFields, userEmail, userId]
    );

    // Render a single field
    const renderField = (field: SignatureField) => {
        const hasSigned = field.value && field.value.trim() !== "";
        const isPlaceholder = field.placeholder;

        // Field styling
        let fieldColor;
        if (isPlaceholder) {
            fieldColor = "border-orange-400 bg-orange-50"; // Orange for placeholders
        } else if (hasSigned) {
            fieldColor = "border-green-500 bg-green-50"; // Green for completed
        } else {
            fieldColor = "border-blue-400 bg-blue-50"; // Blue for regular fields
        }

        // Get display text
        const getDisplayText = () => {
            if (field.placeholder) {
                return field.value || field.placeholderText || `[${field.type.toUpperCase()}]`;
            }

            switch (field.type) {
                case "signature":
                    return field.value || "Your Signature";
                case "initial":
                    return field.value || "YI";
                case "date":
                    return field.value || new Date().toLocaleDateString();
                case "text":
                case "name":
                case "email":
                case "phone":
                case "address":
                    return field.value || `Enter ${field.type}`;
                default:
                    return field.value || "Click to fill";
            }
        };

        // Convert decimal values (0-1) to percentage values (0-100) if needed
        const xPercent = (field.xPct || 0) <= 1 ? (field.xPct || 0) * 100 : (field.xPct || 0);
        const yPercent = (field.yPct || 0) <= 1 ? (field.yPct || 0) * 100 : (field.yPct || 0);
        const wPercent = (field.wPct || 0) <= 1 ? (field.wPct || 0) * 100 : (field.wPct || 25);
        const hPercent = (field.hPct || 0) <= 1 ? (field.hPct || 0) * 100 : (field.hPct || 8);

        console.log(`Field ${field.id} positioning:`, {
            original: { xPct: field.xPct, yPct: field.yPct, wPct: field.wPct, hPct: field.hPct },
            converted: { xPercent, yPercent, wPercent, hPercent }
        });

        return (
            <div
                key={field.id}
                className={`absolute cursor-pointer signature-field border-2 border-dashed ${fieldColor} backdrop-blur-sm rounded-lg 
					flex items-center justify-center hover:shadow-xl transition-all duration-300 ease-out hover:scale-105 shadow-lg`}
                style={{
                    left: `${xPercent}%`,
                    top: `${yPercent}%`,
                    width: `${wPercent}%`,
                    height: `${hPercent}%`,
                    zIndex: 10,
                }}
                onClick={() => handleFieldClick(field)}
            >
                <div className="flex flex-col items-center justify-center p-2 text-center min-w-0">
                    {(field.type === "signature" || field.type === "initial") && field.value && field.value.startsWith("data:image") ? (
                        // Show image only for signature/initial fields with image data
                        <img
                            src={field.value}
                            alt={`${field.type} field`}
                            style={{
                                maxWidth: "100%",
                                maxHeight: "100%",
                                objectFit: "contain",
                                display: "block",
                                margin: "0 auto",
                            }}
                        />
                    ) : (
                        // Show text for all other fields (text fields will show their plain text values)
                        <span
                            className={`font-semibold truncate max-w-full ${field.placeholder ? 'text-gray-600' : 'text-gray-800'}`}
                            style={{
                                fontSize: (field.type === "text" || field.type === "name" || field.type === "email" || field.type === "phone" || field.type === "address") ? '14px' : '12px',
                                lineHeight: "1.2",
                            }}
                        >
                            {getDisplayText()}
                        </span>
                    )}
                </div>

                {/* Sign button for signature/initial fields */}
                {(field.type === "signature" || field.type === "initial") && (
                    <button
                        type="button"
                        className="absolute w-8 h-8 rounded-full bg-green-600 text-white shadow-xl transition-all duration-200 flex items-center justify-center hover:bg-green-700 hover:scale-110 pointer-events-auto cursor-pointer border-2 border-white"
                        style={{
                            left: `calc(100% + 8px)`,
                            top: `-12px`,
                            zIndex: 50,
                        }}
                        onClick={(e) => {
                            e.stopPropagation();
                            handleFieldClick(field);
                        }}
                        title="Click to sign this field"
                    >
                        <PenTool className="w-3.5 h-3.5" />
                    </button>
                )}
            </div>
        );
    };

    return (
        <div className="flex flex-col h-full">
            {/* Signing Progress */}
            {showSigningProgress && template.recipients && template.recipients.length > 0 && (
                <div className="p-4 bg-gray-50 border-b border-gray-200">
                    <SigningProgress
                        recipients={template.recipients}
                        currentUserEmail={userEmail}
                        className="bg-white"
                    />
                </div>
            )}

            {/* Controls */}
            <div className="flex items-center justify-between p-4 bg-white border-b border-gray-200">
                <div className="flex items-center gap-2">
                    <button
                        onClick={handleZoomOut}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                        title="Zoom Out"
                    >
                        <ZoomOut className="w-4 h-4" />
                    </button>
                    <span className="text-sm text-gray-600 min-w-[60px] text-center">
                        {Math.round(zoom * 100)}%
                    </span>
                    <button
                        onClick={handleZoomIn}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                        title="Zoom In"
                    >
                        <ZoomIn className="w-4 h-4" />
                    </button>
                    <button
                        onClick={handleRotate}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors ml-2"
                        title="Rotate"
                    >
                        <RotateCw className="w-4 h-4" />
                    </button>
                </div>

                {/* Page navigation */}
                {template.numPages && template.numPages > 1 && (
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                            disabled={currentPage === 1}
                            className="px-3 py-1 bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed rounded text-sm"
                        >
                            Previous
                        </button>
                        <span className="text-sm text-gray-600">
                            Page {currentPage} of {template.numPages}
                        </span>
                        <button
                            onClick={() => setCurrentPage(prev => Math.min(template.numPages || 1, prev + 1))}
                            disabled={currentPage === (template.numPages || 1)}
                            className="px-3 py-1 bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed rounded text-sm"
                        >
                            Next
                        </button>
                    </div>
                )}
            </div>

            {/* PDF Viewer */}
            <div className="flex-1 bg-white border border-gray-200 rounded-lg overflow-hidden">
                <div
                    className="relative overflow-auto bg-gray-100 flex items-start justify-center"
                    style={{
                        minHeight: "600px",
                        padding: "20px",
                    }}
                >
                    <div className="relative" style={{ maxWidth: "850px", width: "100%" }}>
                        <div
                            ref={contentRef}
                            className="relative w-full"
                            style={{
                                transform: `scale(${zoom}) rotate(${rotation}deg)`,
                                transformOrigin: "center top",
                                transition: "transform 0.2s ease-in-out",
                            }}
                        >
                            <PDFPageCanvas
                                pdfUrl={ensureAbsoluteUrl(template.finalPdfUrl || template.pdfUrl || template.metadata?.originalPdfPath || "")}
                                pageNumber={currentPage}
                                onPageLoad={() => { }}
                            />

                            {/* Fields overlay */}
                            {currentPageFields.map(renderField)}
                        </div>
                    </div>
                </div>
            </div>



            {/* Signature Pad Modal */}
            {activeSignatureField && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                    <SignaturePad
                        field={activeSignatureField}
                        onSignatureComplete={handleSignatureComplete}
                        onClose={() => setActiveSignatureField(null)}
                        className="max-w-2xl w-full max-h-[90vh] overflow-auto"
                    />
                </div>
            )}
        </div>
    );
};