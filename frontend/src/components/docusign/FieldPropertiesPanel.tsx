"use client";

import React, { useState, useEffect } from "react";
import { Settings, X, Check } from "lucide-react";
import { SignatureField } from "@/types/docusign";

interface FieldPropertiesPanelProps {
    field: SignatureField | null;
    onUpdate: (fieldId: string, updates: Partial<SignatureField>) => void;
    onClose: () => void;
}

export const FieldPropertiesPanel: React.FC<FieldPropertiesPanelProps> = ({
    field,
    onUpdate,
    onClose,
}) => {
    const [localField, setLocalField] = useState<SignatureField | null>(null);
    const [hasChanges, setHasChanges] = useState(false);

    useEffect(() => {
        if (field) {
            setLocalField({ ...field });
            setHasChanges(false);
        }
    }, [field]);

    if (!field || !localField) return null;

    const handleInputChange = (key: keyof SignatureField, value: string | number | boolean) => {
        setLocalField(prev => prev ? { ...prev, [key]: value } : null);
        setHasChanges(true);
    };

    const handleSave = () => {
        if (localField && hasChanges) {
            onUpdate(localField.id, localField);
            setHasChanges(false);
        }
    };

    const handleCancel = () => {
        setLocalField(field ? { ...field } : null);
        setHasChanges(false);
    };

    const fieldTypeOptions = [
        { value: "signature", label: "Signature" },
        { value: "initial", label: "Initial" },
        { value: "date", label: "Date" },
        { value: "text", label: "Text" },
    ];

    return (
        <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-4 w-80">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <Settings className="w-4 h-4 text-gray-600" />
                    <h3 className="text-sm font-semibold text-gray-800">Field Properties</h3>
                </div>
                <button
                    onClick={onClose}
                    className="p-1 text-gray-400 hover:text-gray-600 rounded"
                >
                    <X className="w-4 h-4" />
                </button>
            </div>

            <div className="space-y-4">
                {/* Field Type */}
                <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                        Field Type
                    </label>
                    <select
                        value={localField.type}
                        onChange={(e) => handleInputChange("type", e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                        {fieldTypeOptions.map(option => (
                            <option key={option.value} value={option.value}>
                                {option.label}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Field Value */}
                <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                        {localField.type === "signature" ? "Signature Text" :
                            localField.type === "initial" ? "Initial Text" :
                                localField.type === "date" ? "Date Format" : "Text Value"}
                    </label>
                    <input
                        type="text"
                        value={localField.value || ""}
                        onChange={(e) => handleInputChange("value", e.target.value)}
                        placeholder={
                            localField.type === "signature" ? "John Doe" :
                                localField.type === "initial" ? "JD" :
                                    localField.type === "date" ? "MM/DD/YYYY" : "Enter text"
                        }
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                </div>

                {/* Recipient ID */}
                <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                        Recipient ID
                    </label>
                    <input
                        type="text"
                        value={localField.recipientId || ""}
                        onChange={(e) => handleInputChange("recipientId", e.target.value)}
                        placeholder="recipient-1"
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                </div>

                {/* Position and Size */}
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                            X Position (%)
                        </label>
                        <input
                            type="number"
                            min="0"
                            max="100"
                            step="0.1"
                            value={localField.xPct?.toFixed(1) || "0"}
                            onChange={(e) => handleInputChange("xPct", parseFloat(e.target.value))}
                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                            Y Position (%)
                        </label>
                        <input
                            type="number"
                            min="0"
                            max="100"
                            step="0.1"
                            value={localField.yPct?.toFixed(1) || "0"}
                            onChange={(e) => handleInputChange("yPct", parseFloat(e.target.value))}
                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                            Width (%)
                        </label>
                        <input
                            type="number"
                            min="1"
                            max="100"
                            step="0.1"
                            value={localField.wPct?.toFixed(1) || "0"}
                            onChange={(e) => handleInputChange("wPct", parseFloat(e.target.value))}
                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                            Height (%)
                        </label>
                        <input
                            type="number"
                            min="1"
                            max="100"
                            step="0.1"
                            value={localField.hPct?.toFixed(1) || "0"}
                            onChange={(e) => handleInputChange("hPct", parseFloat(e.target.value))}
                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                    </div>
                </div>

                {/* Required Field */}
                <div className="flex items-center gap-2">
                    <input
                        type="checkbox"
                        id="required"
                        checked={localField.required || false}
                        onChange={(e) => handleInputChange("required", e.target.checked)}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <label htmlFor="required" className="text-xs font-medium text-gray-700">
                        Required field
                    </label>
                </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 mt-6 pt-4 border-t border-gray-200">
                <button
                    onClick={handleSave}
                    disabled={!hasChanges}
                    className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium rounded-md transition-colors ${hasChanges
                        ? "bg-blue-600 hover:bg-blue-700 text-white"
                        : "bg-gray-100 text-gray-400 cursor-not-allowed"
                        }`}
                >
                    <Check className="w-4 h-4" />
                    Save Changes
                </button>
                <button
                    onClick={handleCancel}
                    disabled={!hasChanges}
                    className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${hasChanges
                        ? "bg-gray-100 hover:bg-gray-200 text-gray-700"
                        : "bg-gray-50 text-gray-400 cursor-not-allowed"
                        }`}
                >
                    Cancel
                </button>
            </div>
        </div>
    );
};