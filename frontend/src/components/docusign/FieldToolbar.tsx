"use client";

import React, { useState } from "react";
import { PenTool, Type, Calendar, FileSignature, Plus } from "lucide-react";
import { SignatureField } from "@/types/docusign";

interface FieldToolbarProps {
    onAddField: (fieldType: SignatureField["type"]) => void;
    disabled?: boolean;
}

export const FieldToolbar: React.FC<FieldToolbarProps> = ({ onAddField, disabled = false }) => {
    const [selectedType, setSelectedType] = useState<SignatureField["type"]>("signature");

    const fieldTypes = [
        {
            type: "signature" as const,
            label: "Signature",
            icon: PenTool,
            description: "Full signature field",
            color: "bg-blue-500 hover:bg-blue-600",
        },
        {
            type: "initial" as const,
            label: "Initial",
            icon: FileSignature,
            description: "Initial field",
            color: "bg-green-500 hover:bg-green-600",
        },
        {
            type: "date" as const,
            label: "Date",
            icon: Calendar,
            description: "Date field",
            color: "bg-purple-500 hover:bg-purple-600",
        },
        {
            type: "text" as const,
            label: "Text",
            icon: Type,
            description: "Text input field",
            color: "bg-orange-500 hover:bg-orange-600",
        },
    ];

    const handleAddField = (fieldType: SignatureField["type"]) => {
        setSelectedType(fieldType);
        onAddField(fieldType);
    };

    return (
        <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-800">Add Field</h3>
                <div className="text-xs text-gray-500">Click on document to place</div>
            </div>

            <div className="grid grid-cols-2 gap-2">
                {fieldTypes.map((fieldType) => {
                    const Icon = fieldType.icon;
                    const isSelected = selectedType === fieldType.type;

                    return (
                        <button
                            key={fieldType.type}
                            onClick={() => handleAddField(fieldType.type)}
                            disabled={disabled}
                            className={`
								relative flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all duration-200
								${isSelected
                                    ? `${fieldType.color} text-white border-transparent shadow-md`
                                    : "bg-gray-50 hover:bg-gray-100 text-gray-700 border-gray-200 hover:border-gray-300"
                                }
								${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
							`}
                            title={fieldType.description}
                        >
                            <Icon className="w-5 h-5" />
                            <span className="text-xs font-medium">{fieldType.label}</span>

                            {isSelected && (
                                <div className="absolute -top-1 -right-1 w-4 h-4 bg-white text-gray-800 rounded-full flex items-center justify-center">
                                    <Plus className="w-2.5 h-2.5" />
                                </div>
                            )}
                        </button>
                    );
                })}
            </div>

            <div className="mt-3 p-2 bg-blue-50 border border-blue-200 rounded-md">
                <div className="text-xs text-blue-700">
                    <strong>Selected:</strong> {fieldTypes.find(f => f.type === selectedType)?.label}
                </div>
                <div className="text-xs text-blue-600 mt-1">
                    Click anywhere on the document to add this field type
                </div>
            </div>
        </div>
    );
};