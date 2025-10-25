"use client";

import React, { useState } from "react";
import { RecipientManager } from "./RecipientManager";
import { SigningProgress } from "./SigningProgress";
import { RecipientData } from "@/types/docusign";

export const SigningOrderDemo: React.FC = () => {
    const [recipients, setRecipients] = useState<RecipientData[]>([
        {
            id: "1",
            name: "Alice Johnson",
            email: "alice@example.com",
            signatureStatus: "signed",
            signingOrder: 1,
            signedAt: "2024-01-15T10:30:00Z",
        },
        {
            id: "2",
            name: "Bob Smith",
            email: "bob@example.com",
            signatureStatus: "pending",
            signingOrder: 2,
            eligibleAt: "2024-01-15T10:30:00Z",
        },
        {
            id: "3",
            name: "Carol Davis",
            email: "carol@example.com",
            signatureStatus: "waiting",
            signingOrder: 3,
        },
        {
            id: "4",
            name: "David Wilson",
            email: "david@example.com",
            signatureStatus: "waiting",
            signingOrder: 4,
        },
    ]);

    const handleRecipientsChange = (newRecipients: RecipientData[]) => {
        setRecipients(newRecipients);
    };

    const handleSaveRecipients = async (newRecipients: RecipientData[]) => {
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 1000));
        console.log("Saved recipients:", newRecipients);
        alert("Recipients saved successfully!");
    };

    const simulateSignature = (recipientId: string) => {
        setRecipients(prev => {
            const updated = prev.map(r => {
                if (r.id === recipientId) {
                    return {
                        ...r,
                        signatureStatus: "signed" as const,
                        signedAt: new Date().toISOString(),
                    };
                }
                return r;
            });

            // Update next recipient to pending
            const sortedRecipients = updated.sort((a, b) => a.signingOrder - b.signingOrder);
            const nextToSign = sortedRecipients.find(r => r.signatureStatus === "waiting");

            if (nextToSign) {
                return updated.map(r =>
                    r.id === nextToSign.id
                        ? { ...r, signatureStatus: "pending" as const, eligibleAt: new Date().toISOString() }
                        : r
                );
            }

            return updated;
        });
    };

    return (
        <div className="max-w-4xl mx-auto p-6 space-y-8">
            <div className="text-center">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">
                    Signing Order System Demo
                </h1>
                <p className="text-gray-600">
                    This demonstrates how recipients sign documents in a specific order
                </p>
            </div>

            {/* Current Progress */}
            <div className="bg-white rounded-lg shadow-lg p-6">
                <h2 className="text-xl font-semibold mb-4">Current Signing Progress</h2>
                <SigningProgress
                    recipients={recipients}
                    currentUserEmail="bob@example.com" // Simulate Bob as current user
                />

                {/* Demo Actions */}
                <div className="mt-6 flex gap-3 flex-wrap">
                    {recipients.map(recipient => (
                        <button
                            key={recipient.id}
                            onClick={() => simulateSignature(recipient.id)}
                            disabled={recipient.signatureStatus === "signed"}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${recipient.signatureStatus === "signed"
                                    ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                                    : recipient.signatureStatus === "pending"
                                        ? "bg-blue-600 hover:bg-blue-700 text-white"
                                        : "bg-gray-300 hover:bg-gray-400 text-gray-700"
                                }`}
                        >
                            {recipient.signatureStatus === "signed"
                                ? `${recipient.name} ✓`
                                : `Sign as ${recipient.name}`
                            }
                        </button>
                    ))}
                </div>
            </div>

            {/* Recipient Management */}
            <div className="bg-white rounded-lg shadow-lg p-6">
                <h2 className="text-xl font-semibold mb-4">Manage Recipients & Signing Order</h2>
                <RecipientManager
                    recipients={recipients}
                    onRecipientsChange={handleRecipientsChange}
                    onSave={handleSaveRecipients}
                />
            </div>

            {/* Instructions */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-blue-900 mb-3">How It Works</h3>
                <div className="space-y-2 text-blue-800">
                    <p>• <strong>Sequential Signing:</strong> Recipients must sign in the specified order</p>
                    <p>• <strong>Status Tracking:</strong> Each recipient has a status (waiting, pending, signed)</p>
                    <p>• <strong>Progress Visualization:</strong> Clear progress bar and next-to-sign indicator</p>
                    <p>• <strong>Order Management:</strong> Senders can reorder recipients before sending</p>
                    <p>• <strong>Real-time Updates:</strong> Status updates automatically when someone signs</p>
                </div>
            </div>

            {/* API Integration Example */}
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">API Integration</h3>
                <div className="text-sm text-gray-700 space-y-2">
                    <p><code className="bg-gray-200 px-2 py-1 rounded">POST /api/docusign/:templateId/recipients</code> - Add recipients</p>
                    <p><code className="bg-gray-200 px-2 py-1 rounded">PUT /api/docusign/:templateId/recipients/order</code> - Update signing order</p>
                    <p><code className="bg-gray-200 px-2 py-1 rounded">GET /api/docusign/:templateId/signing-progress</code> - Get progress</p>
                    <p><code className="bg-gray-200 px-2 py-1 rounded">GET /api/docusign/:templateId/signing-eligibility</code> - Check if user can sign</p>
                </div>
            </div>
        </div>
    );
};