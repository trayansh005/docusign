"use client";

import React, { useState } from "react";
import { Plus, Trash2, GripVertical, Mail, User, ArrowUp, ArrowDown } from "lucide-react";
import { RecipientData } from "@/types/docusign";

interface RecipientManagerProps {
    recipients: RecipientData[];
    onRecipientsChange: (recipients: RecipientData[]) => void;
    onSave: (recipients: RecipientData[]) => Promise<void>;
    disabled?: boolean;
    className?: string;
}

interface NewRecipient {
    name: string;
    email: string;
}

export const RecipientManager: React.FC<RecipientManagerProps> = ({
    recipients,
    onRecipientsChange,
    onSave,
    disabled = false,
    className = "",
}) => {
    const [newRecipient, setNewRecipient] = useState<NewRecipient>({ name: "", email: "" });
    const [isAdding, setIsAdding] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    // Sort recipients by signing order for display
    const sortedRecipients = [...recipients].sort((a, b) => a.signingOrder - b.signingOrder);

    const handleAddRecipient = () => {
        if (!newRecipient.name.trim() || !newRecipient.email.trim()) {
            return;
        }

        const recipient: RecipientData = {
            id: `temp-${Date.now()}`,
            name: newRecipient.name.trim(),
            email: newRecipient.email.trim().toLowerCase(),
            signatureStatus: "waiting",
            signingOrder: recipients.length + 1,
        };

        const updatedRecipients = [...recipients, recipient];
        onRecipientsChange(updatedRecipients);

        // Reset form
        setNewRecipient({ name: "", email: "" });
        setIsAdding(false);
    };

    const handleRemoveRecipient = (recipientId: string) => {
        const updatedRecipients = recipients
            .filter(r => r.id !== recipientId)
            .map((r, index) => ({ ...r, signingOrder: index + 1 })); // Reorder after removal

        onRecipientsChange(updatedRecipients);
    };

    const handleMoveRecipient = (recipientId: string, direction: "up" | "down") => {
        const currentIndex = sortedRecipients.findIndex(r => r.id === recipientId);
        if (currentIndex === -1) return;

        const newIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
        if (newIndex < 0 || newIndex >= sortedRecipients.length) return;

        // Swap the signing orders
        const updatedRecipients = [...recipients];
        const currentRecipient = updatedRecipients.find(r => r.id === recipientId);
        const targetRecipient = updatedRecipients.find(r => r.id === sortedRecipients[newIndex].id);

        if (currentRecipient && targetRecipient) {
            const tempOrder = currentRecipient.signingOrder;
            currentRecipient.signingOrder = targetRecipient.signingOrder;
            targetRecipient.signingOrder = tempOrder;
        }

        onRecipientsChange(updatedRecipients);
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await onSave(recipients);
        } catch (error) {
            console.error("Failed to save recipients:", error);
        } finally {
            setIsSaving(false);
        }
    };

    const isValidEmail = (email: string) => {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    };

    const canAddRecipient = newRecipient.name.trim() && isValidEmail(newRecipient.email.trim());

    return (
        <div className={`bg-white border border-gray-200 rounded-lg p-6 ${className}`}>
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Recipients</h3>
                <div className="text-sm text-gray-600">
                    {recipients.length} recipient{recipients.length !== 1 ? "s" : ""}
                </div>
            </div>

            {/* Recipients list */}
            {sortedRecipients.length > 0 && (
                <div className="space-y-3 mb-6">
                    {sortedRecipients.map((recipient, index) => (
                        <div
                            key={recipient.id}
                            className="flex items-center gap-4 p-4 border border-gray-200 rounded-lg bg-gray-50"
                        >
                            {/* Order controls */}
                            <div className="flex flex-col gap-1">
                                <button
                                    type="button"
                                    onClick={() => handleMoveRecipient(recipient.id, "up")}
                                    disabled={disabled || index === 0}
                                    className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                                    title="Move up"
                                >
                                    <ArrowUp className="w-3 h-3" />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleMoveRecipient(recipient.id, "down")}
                                    disabled={disabled || index === sortedRecipients.length - 1}
                                    className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                                    title="Move down"
                                >
                                    <ArrowDown className="w-3 h-3" />
                                </button>
                            </div>

                            {/* Order number */}
                            <div className="flex-shrink-0 w-8 h-8 bg-blue-100 border border-blue-200 rounded-full flex items-center justify-center text-sm font-medium text-blue-700">
                                {recipient.signingOrder}
                            </div>

                            {/* Recipient info */}
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <User className="w-4 h-4 text-gray-500" />
                                    <span className="font-medium text-gray-900 truncate">
                                        {recipient.name}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2 mt-1">
                                    <Mail className="w-4 h-4 text-gray-400" />
                                    <span className="text-sm text-gray-600 truncate">{recipient.email}</span>
                                </div>
                            </div>

                            {/* Status */}
                            <div className="flex-shrink-0">
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${recipient.signatureStatus === "signed"
                                        ? "bg-green-100 text-green-800"
                                        : recipient.signatureStatus === "pending"
                                            ? "bg-blue-100 text-blue-800"
                                            : "bg-gray-100 text-gray-800"
                                    }`}>
                                    {recipient.signatureStatus === "signed" ? "Signed" :
                                        recipient.signatureStatus === "pending" ? "Ready" : "Waiting"}
                                </span>
                            </div>

                            {/* Remove button */}
                            <button
                                type="button"
                                onClick={() => handleRemoveRecipient(recipient.id)}
                                disabled={disabled || recipient.signatureStatus === "signed"}
                                className="p-2 text-gray-400 hover:text-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
                                title="Remove recipient"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* Add recipient form */}
            {isAdding ? (
                <div className="border border-gray-200 rounded-lg p-4 mb-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Name
                            </label>
                            <input
                                type="text"
                                value={newRecipient.name}
                                onChange={(e) => setNewRecipient(prev => ({ ...prev, name: e.target.value }))}
                                placeholder="Enter recipient name"
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                disabled={disabled}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Email
                            </label>
                            <input
                                type="email"
                                value={newRecipient.email}
                                onChange={(e) => setNewRecipient(prev => ({ ...prev, email: e.target.value }))}
                                placeholder="Enter recipient email"
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                disabled={disabled}
                            />
                        </div>
                    </div>
                    <div className="flex gap-2 mt-4">
                        <button
                            type="button"
                            onClick={handleAddRecipient}
                            disabled={disabled || !canAddRecipient}
                            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                        >
                            Add Recipient
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setIsAdding(false);
                                setNewRecipient({ name: "", email: "" });
                            }}
                            disabled={disabled}
                            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            ) : (
                <button
                    type="button"
                    onClick={() => setIsAdding(true)}
                    disabled={disabled}
                    className="w-full flex items-center justify-center gap-2 p-4 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-gray-400 hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                    <Plus className="w-5 h-5" />
                    Add Recipient
                </button>
            )}

            {/* Save button */}
            {recipients.length > 0 && (
                <div className="flex justify-end mt-6">
                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={disabled || isSaving}
                        className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                    >
                        {isSaving ? "Saving..." : "Save Recipients"}
                    </button>
                </div>
            )}

            {/* Instructions */}
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-800">
                    <strong>Signing Order:</strong> Recipients will sign in the order shown above.
                    Use the arrow buttons to reorder recipients. Each person must wait for the previous person to sign.
                </p>
            </div>
        </div>
    );
};