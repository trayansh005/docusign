"use client";

import React from "react";
import { CheckCircle, Clock, User, Mail, AlertCircle } from "lucide-react";
import { RecipientData } from "@/types/docusign";

interface SigningProgressProps {
    recipients: RecipientData[];
    currentUserEmail?: string;
    className?: string;
}

export const SigningProgress: React.FC<SigningProgressProps> = ({
    recipients,
    currentUserEmail,
    className = "",
}) => {
    if (!recipients || recipients.length === 0) {
        return null;
    }

    // Sort recipients by signing order
    const sortedRecipients = [...recipients].sort((a, b) => a.signingOrder - b.signingOrder);

    // Calculate progress
    const totalRecipients = sortedRecipients.length;
    const signedRecipients = sortedRecipients.filter(r => r.signatureStatus === "signed").length;
    const completionPercentage = totalRecipients > 0 ? Math.round((signedRecipients / totalRecipients) * 100) : 0;

    // Find next recipient to sign
    const nextRecipient = sortedRecipients.find(r => r.signatureStatus === "pending");

    const getStatusIcon = (recipient: RecipientData) => {
        switch (recipient.signatureStatus) {
            case "signed":
                return <CheckCircle className="w-5 h-5 text-green-600" />;
            case "pending":
                return <Clock className="w-5 h-5 text-blue-600" />;
            case "declined":
                return <AlertCircle className="w-5 h-5 text-red-600" />;
            case "waiting":
            default:
                return <Clock className="w-5 h-5 text-gray-400" />;
        }
    };

    const getStatusColor = (recipient: RecipientData) => {
        switch (recipient.signatureStatus) {
            case "signed":
                return "border-green-200 bg-green-50";
            case "pending":
                return "border-blue-200 bg-blue-50";
            case "declined":
                return "border-red-200 bg-red-50";
            case "waiting":
            default:
                return "border-gray-200 bg-gray-50";
        }
    };

    const getStatusText = (recipient: RecipientData) => {
        switch (recipient.signatureStatus) {
            case "signed":
                return `Signed ${recipient.signedAt ? new Date(recipient.signedAt).toLocaleDateString() : ""}`;
            case "pending":
                return "Ready to sign";
            case "declined":
                return "Declined to sign";
            case "waiting":
            default:
                return "Waiting for turn";
        }
    };

    return (
        <div className={`bg-white border border-gray-200 rounded-lg p-6 ${className}`}>
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Signing Progress</h3>
                <div className="text-sm text-gray-600">
                    {signedRecipients} of {totalRecipients} completed
                </div>
            </div>

            {/* Progress bar */}
            <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">Overall Progress</span>
                    <span className="text-sm font-medium text-gray-900">{completionPercentage}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${completionPercentage}%` }}
                    ></div>
                </div>
            </div>

            {/* Next to sign indicator */}
            {nextRecipient && (
                <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-blue-600" />
                        <span className="text-sm font-medium text-blue-900">
                            Next to sign: {nextRecipient.name}
                            {currentUserEmail === nextRecipient.email && " (You)"}
                        </span>
                    </div>
                </div>
            )}

            {/* Recipients list */}
            <div className="space-y-3">
                {sortedRecipients.map((recipient, index) => (
                    <div
                        key={recipient.id}
                        className={`flex items-center gap-4 p-4 border rounded-lg transition-all duration-200 ${getStatusColor(recipient)}`}
                    >
                        {/* Order number */}
                        <div className="flex-shrink-0 w-8 h-8 bg-white border border-gray-300 rounded-full flex items-center justify-center text-sm font-medium text-gray-700">
                            {recipient.signingOrder}
                        </div>

                        {/* Status icon */}
                        <div className="flex-shrink-0">
                            {getStatusIcon(recipient)}
                        </div>

                        {/* Recipient info */}
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                                <User className="w-4 h-4 text-gray-500" />
                                <span className="font-medium text-gray-900 truncate">
                                    {recipient.name}
                                    {currentUserEmail === recipient.email && " (You)"}
                                </span>
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                                <Mail className="w-4 h-4 text-gray-400" />
                                <span className="text-sm text-gray-600 truncate">{recipient.email}</span>
                            </div>
                        </div>

                        {/* Status text */}
                        <div className="flex-shrink-0 text-right">
                            <div className="text-sm font-medium text-gray-900">
                                {getStatusText(recipient)}
                            </div>
                            {recipient.signatureStatus === "pending" && (
                                <div className="text-xs text-blue-600 mt-1">
                                    {currentUserEmail === recipient.email ? "Your turn!" : "Waiting..."}
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {/* Completion message */}
            {completionPercentage === 100 && (
                <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-center gap-2">
                        <CheckCircle className="w-5 h-5 text-green-600" />
                        <span className="text-sm font-medium text-green-900">
                            All recipients have signed! Document is complete.
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
};