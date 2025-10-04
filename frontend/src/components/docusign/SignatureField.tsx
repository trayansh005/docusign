"use client";

import React, { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { Trash2, Move } from "lucide-react";
import { SignatureField as SignatureFieldType } from "@/types/docusign";
import { useAuth } from "@/contexts/AuthContext";

interface SignatureFieldProps {
    field: SignatureFieldType;
    editable: boolean;
    containerRef: React.RefObject<HTMLDivElement>;
    onUpdate: (fieldId: string, updates: Partial<SignatureFieldType>) => void;
    onRemove: (fieldId: string) => void;
    onSelect: () => void;
    isSelected: boolean;

}

interface DragState {
    isDragging: boolean;
    isResizing: boolean;
    startX: number;
    startY: number;
    startFieldX: number;
    startFieldY: number;
    startFieldW: number;
    startFieldH: number;
}

export const SignatureField: React.FC<SignatureFieldProps> = ({
    field,
    editable,
    containerRef,
    onUpdate,
    onRemove,
    onSelect,
    isSelected,
}) => {
    const { user } = useAuth();
    const [isHovered, setIsHovered] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const dragState = useRef<DragState>({
        isDragging: false,
        isResizing: false,
        startX: 0,
        startY: 0,
        startFieldX: 0,
        startFieldY: 0,
        startFieldW: 0,
        startFieldH: 0,
    });

    // Field type configurations with user's name
    const getUserDisplayName = () => {
        if (user?.firstName && user?.lastName) {
            return `${user.firstName} ${user.lastName}`;
        } else if (user?.firstName) {
            return user.firstName;
        }
        return "John Doe";
    };

    const getUserInitials = () => {
        if (user?.firstName && user?.lastName) {
            return `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`;
        } else if (user?.firstName) {
            return user.firstName.charAt(0);
        }
        return "JD";
    };

    const fieldConfig = {
        signature: {
            label: getUserDisplayName(),
            placeholder: getUserDisplayName(),
            fontFamily: "signature-font",
            minWidth: 8,
            minHeight: 3,
            defaultWidth: 20,
            defaultHeight: 6,
            color: "#1f2937",
            fontWeight: 400,
        },
        initial: {
            label: getUserInitials(),
            placeholder: getUserInitials(),
            fontFamily: "signature-font",
            minWidth: 4,
            minHeight: 3,
            defaultWidth: 8,
            defaultHeight: 6,
            color: "#1f2937",
            fontWeight: 400,
        },
        date: {
            label: new Date().toLocaleDateString(),
            placeholder: "DATE",
            fontFamily: "",
            minWidth: 6,
            minHeight: 2,
            defaultWidth: 12,
            defaultHeight: 4,
            color: "#374151",
            fontWeight: 600,
        },
        text: {
            label: "Text Field",
            placeholder: "TEXT",
            fontFamily: "",
            minWidth: 6,
            minHeight: 2,
            defaultWidth: 15,
            defaultHeight: 4,
            color: "#374151",
            fontWeight: 600,
        },
    };

    const config = fieldConfig[field.type] || fieldConfig.text;

    // Memoized font size calculation for better performance
    const fontSize = useMemo(() => {
        if (!containerRef.current) return 12;

        const containerRect = containerRef.current.getBoundingClientRect();
        const pixelHeight = (field.hPct / 100) * containerRect.height;

        // Match backend font size calculation exactly
        let baseFactor: number;
        let minSize: number;
        let maxSize: number;

        switch (field.type) {
            case "signature":
                baseFactor = 0.5; // Same as backend
                minSize = 12;
                maxSize = 32;
                break;
            case "initial":
                baseFactor = 0.65;
                minSize = 10;
                maxSize = 24;
                break;
            case "date":
            case "text":
                baseFactor = 0.35; // Adjusted to match backend
                minSize = 12;
                maxSize = 18;
                break;
            default:
                baseFactor = 0.35;
                minSize = 12;
                maxSize = 18;
        }

        // Calculate font size with same logic as backend
        const calculatedSize = Math.min(
            Math.max(pixelHeight * baseFactor, minSize),
            maxSize
        );

        return Math.round(calculatedSize);
    }, [field.hPct, field.type, containerRef]); // Include containerRef as dependency

    // Mouse event handlers with improved smoothness
    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        if (!editable) return;

        e.preventDefault();
        e.stopPropagation();

        onSelect();
        setIsDragging(true);

        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect) return;

        dragState.current = {
            isDragging: true,
            isResizing: false,
            startX: e.clientX,
            startY: e.clientY,
            startFieldX: field.xPct,
            startFieldY: field.yPct,
            startFieldW: field.wPct,
            startFieldH: field.hPct,
        };

        // Use passive listeners for better performance
        document.addEventListener("mousemove", handleMouseMove, { passive: false });
        document.addEventListener("mouseup", handleMouseUp, { passive: true });
        document.body.style.cursor = "grabbing";
        document.body.style.userSelect = "none";

        // Add visual feedback
        document.body.style.pointerEvents = "none";
    }, [editable, field, containerRef, onSelect]);

    const handleResizeMouseDown = useCallback((e: React.MouseEvent) => {
        if (!editable) return;

        e.preventDefault();
        e.stopPropagation();

        onSelect();

        dragState.current = {
            isDragging: false,
            isResizing: true,
            startX: e.clientX,
            startY: e.clientY,
            startFieldX: field.xPct,
            startFieldY: field.yPct,
            startFieldW: field.wPct,
            startFieldH: field.hPct,
        };

        document.addEventListener("mousemove", handleMouseMove, { passive: false });
        document.addEventListener("mouseup", handleMouseUp, { passive: true });
        document.body.style.cursor = "se-resize";
        document.body.style.userSelect = "none";
        document.body.style.pointerEvents = "none";
    }, [editable, field, onSelect]);

    const handleMouseMove = useCallback((e: MouseEvent) => {
        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect || (!dragState.current.isDragging && !dragState.current.isResizing)) return;

        // Use requestAnimationFrame for smoother updates
        requestAnimationFrame(() => {
            const deltaX = e.clientX - dragState.current.startX;
            const deltaY = e.clientY - dragState.current.startY;

            // Convert pixel deltas to percentage
            const deltaXPct = (deltaX / rect.width) * 100;
            const deltaYPct = (deltaY / rect.height) * 100;

            if (dragState.current.isDragging) {
                // Dragging - update position with bounds checking
                const newX = Math.max(0, Math.min(100 - field.wPct, dragState.current.startFieldX + deltaXPct));
                const newY = Math.max(0, Math.min(100 - field.hPct, dragState.current.startFieldY + deltaYPct));

                onUpdate(field.id, { xPct: newX, yPct: newY });
            } else if (dragState.current.isResizing) {
                // Resizing - update dimensions with minimum size constraints
                const newW = Math.max(config.minWidth, Math.min(100 - field.xPct, dragState.current.startFieldW + deltaXPct));
                const newH = Math.max(config.minHeight, Math.min(100 - field.yPct, dragState.current.startFieldH + deltaYPct));

                onUpdate(field.id, { wPct: newW, hPct: newH });
            }
        });
    }, [field, onUpdate, config, containerRef]);

    const handleMouseUp = useCallback(() => {
        dragState.current.isDragging = false;
        dragState.current.isResizing = false;
        setIsDragging(false);

        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        document.body.style.pointerEvents = "";
    }, [handleMouseMove]);

    // Cleanup effect to prevent memory leaks
    useEffect(() => {
        return () => {
            // Cleanup any remaining event listeners
            document.removeEventListener("mousemove", handleMouseMove);
            document.removeEventListener("mouseup", handleMouseUp);
            document.body.style.cursor = "";
            document.body.style.userSelect = "";
            document.body.style.pointerEvents = "";
        };
    }, [handleMouseMove, handleMouseUp]);

    const handleClick = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        onSelect();
    }, [onSelect]);

    const handleRemove = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        onRemove(field.id);
    }, [field.id, onRemove]);

    // Determine display text
    const displayText = (() => {
        if (field.value && field.value.trim()) {
            return field.value;
        }
        return editable ? config.placeholder : config.label;
    })();

    // Field styles with improved drag feedback
    const fieldStyle: React.CSSProperties = {
        position: "absolute",
        left: `${field.xPct}%`,
        top: `${field.yPct}%`,
        width: `${field.wPct}%`,
        height: `${field.hPct}%`,
        border: editable
            ? isSelected
                ? "2px solid #3b82f6"
                : isHovered || isDragging
                    ? "2px dashed #60a5fa"
                    : "2px dashed rgba(59,130,246,0.4)"
            : "1px solid rgba(0,0,0,0.1)",
        backgroundColor: editable
            ? isSelected || isDragging
                ? "rgba(59, 130, 246, 0.15)"
                : isHovered
                    ? "rgba(59, 130, 246, 0.1)"
                    : "rgba(59, 130, 246, 0.05)"
            : "rgba(255, 255, 255, 0.9)",
        borderRadius: "6px",
        cursor: editable
            ? isDragging
                ? "grabbing"
                : isHovered
                    ? "grab"
                    : "move"
            : "default",
        transition: isDragging ? "none" : "all 0.2s ease-in-out",
        boxShadow: editable
            ? isSelected || isDragging
                ? "0 4px 12px rgba(59, 130, 246, 0.3)"
                : isHovered
                    ? "0 2px 8px rgba(0,0,0,0.15)"
                    : "0 1px 4px rgba(0,0,0,0.1)"
            : "0 1px 2px rgba(0,0,0,0.05)",
        zIndex: isSelected || isDragging ? 20 : isHovered ? 15 : 10,
        transform: isDragging ? "scale(1.02)" : "scale(1)",
        willChange: isDragging ? "transform" : "auto",
    };

    const textStyle: React.CSSProperties = {
        fontSize: `${fontSize}px`,
        color: config.color,
        fontWeight: config.fontWeight,
        lineHeight: field.type === "signature" || field.type === "initial" ? 1.2 : 1.1,
        letterSpacing: field.type === "signature" || field.type === "initial" ? "0.5px" : "normal",
        textShadow: field.type === "signature" || field.type === "initial" ? "0 1px 2px rgba(0,0,0,0.1)" : "none",
    };

    return (
        <div
            style={fieldStyle}
            className={`group flex items-center justify-center select-none ${config.fontFamily}`}
            onMouseDown={handleMouseDown}
            onClick={handleClick}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            title={editable ? `${field.type.toUpperCase()} field - Click to select, drag to move` : displayText}
        >
            {/* Field Content */}
            <div className="w-full h-full flex items-center justify-center px-2 overflow-hidden">
                <span style={textStyle} className="truncate text-center">
                    {displayText}
                </span>
            </div>

            {/* Controls - only show when editable and hovered/selected */}
            {editable && (isHovered || isSelected) && (
                <>
                    {/* Delete button */}
                    <button
                        type="button"
                        onClick={handleRemove}
                        className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 hover:bg-red-600 text-white rounded-full shadow-lg flex items-center justify-center transition-all duration-200 hover:scale-110 z-30"
                        title="Delete field"
                    >
                        <Trash2 className="w-3 h-3" />
                    </button>

                    {/* Resize handle */}
                    <div
                        onMouseDown={handleResizeMouseDown}
                        className="absolute -bottom-1 -right-1 w-4 h-4 bg-blue-500 hover:bg-blue-600 border-2 border-white rounded-full cursor-se-resize shadow-md transition-all duration-200 hover:scale-110 z-30"
                        style={{ transform: "translate(50%, 50%)" }}
                        title="Drag to resize"
                    />

                    {/* Move indicator */}
                    {isSelected && (
                        <div className="absolute -top-2 -left-2 w-6 h-6 bg-blue-500 text-white rounded-full shadow-lg flex items-center justify-center z-30">
                            <Move className="w-3 h-3" />
                        </div>
                    )}
                </>
            )}
        </div>
    );
};