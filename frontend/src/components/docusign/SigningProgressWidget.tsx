"use client";

import React from "react";
import { Clock, CheckCircle, Users, Eye } from "lucide-react";
import { RecipientData } from "@/types/docusign";

interface SigningProgressWidgetProps {
    recipients: RecipientData[];
    templateId: string;
    onViewDetails?: () => void;
    className?: string;
}

export const SigningProgressWidget: React.FC<SigningProgressWidgetProps> = ({
    recipients,
    templateId,
    onViewDetails,
    className = "",
}) => {
    if (!recipients || recipients.length === 0) {
        return (
            <div className={`bg-gray-50 border border-gray-200 rounded-lg p-4 ${className}`}>
                <div className="flex items-center justify-center text-gray-500">
                    <Users className="w-5 h-5 mr-2" />
                    <span className="text-sm">No recipients added</span>
                </div>
            </div>
        );
    }

    // Calculate progress
    const totalRecipients = recipients.length;
    const signedRecipients = recipients.filter(r => r.signatureStatus === "signed").length;
    const completionPercentage = totalRecipients > 0 ? Math.round((signedRecipients / totalRecipients) * 100) : 0;

    // Find next recipient to sign
    const sortedRecipients = [...recipients].sort((a, b) => a.signingOrder - b.signingOrder);
    const nextRecipient = sortedRecipients.find(r => r.signatureStatus === "pending");

    const isComplete = signedRecipients === totalRecipients;

    console.log("SigningProgressWidget - Recipients:", recipients);
    console.log("SigningProgressWidget - Progress:", { totalRecipients, signedRecipients, completionPercentage, nextRecipient });

    return (
        <div className={`bg-white border border-gray-200 rounded-lg p-4 ${className}`}>
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center">
                    {isComplete ? (
                        <CheckCircle className="w-5 h-5 text-green-600 mr-2" />
                    ) : (
                        <Clock className="w-5 h-5 text-blue-600 mr-2" />
                    )}
                    <span className="text-sm font-medium text-gray-900">
                        {isComplete ? "Completed" : "In Progress"}
                    </span>
                </div>
                {onViewDetails && (
                    <button
                        onClick={onViewDetails}
                        className="text-blue-600 hover:text-blue-700 text-sm font-medium flex items-center"
                    >
                        <Eye className="w-4 h-4 mr-1" />
                        View Details
                    </button>
                )}
            </div>

            {/* Progress Bar */}
            <div className="mb-3">
                <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-gray-600">
                        {signedRecipients} of {totalRecipients} signed
                    </span>
                    <span className="text-xs font-medium text-gray-900">
                        {completionPercentage}%
                    </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                        className={`h-2 rounded-full transition-all duration-300 ${isComplete ? "bg-green-500" : "bg-blue-600"
                            }`}
                        style={{ width: `${completionPercentage}%` }}
                    ></div>
                </div>
            </div>

            {/* Next Recipient or Completion */}
            {isComplete ? (
                <div className="flex items-center text-green-700 bg-green-50 rounded-lg p-2">
                    <CheckCircle className="w-4 h-4 mr-2" />
                    <span className="text-sm font-medium">All recipients have signed!</span>
                </div>
            ) : nextRecipient ? (
                <div className="flex items-center text-blue-700 bg-blue-50 rounded-lg p-2">
                    <Clock className="w-4 h-4 mr-2" />
                    <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium">Next: </span>
                        <span className="text-sm truncate">{nextRecipient.name}</span>
                    </div>
                </div>
            ) : (
                <div className="flex items-center text-gray-600 bg-gray-50 rounded-lg p-2">
                    <Users className="w-4 h-4 mr-2" />
                    <span className="text-sm">Waiting for signatures...</span>
                </div>
            )}

            {/* Recipient List */}
            <div className="mt-3 space-y-1">
                <div className="text-xs font-medium text-gray-700 mb-2">Recipients:</div>
                {sortedRecipients.slice(0, 3).map((recipient) => (
                    <div key={recipient.id} className="flex items-center text-xs">
                        <span className={`w-5 h-5 rounded-full flex items-center justify-center text-white text-xs font-medium mr-2 flex-shrink-0 ${recipient.signatureStatus === "signed"
                                ? "bg-green-500"
                                : recipient.signatureStatus === "pending"
                                    ? "bg-blue-500"
                                    : "bg-gray-400"
                            }`}>
                            {recipient.signingOrder}
                        </span>
                        <span className="text-gray-900 truncate flex-1">
                            {recipient.name}
                        </span>
                        {recipient.signatureStatus === "signed" && (
                            <CheckCircle className="w-3 h-3 text-green-600 ml-1 flex-shrink-0" />
                        )}
                    </div>
                ))}
                {sortedRecipients.length > 3 && (
                    <div className="text-xs text-gray-500 ml-7">
                        +{sortedRecipients.length - 3} more
                    </div>
                )}
            </div>

            {/* Quick Stats */}
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                <div className="bg-gray-50 rounded p-2">
                    <div className="text-lg font-bold text-gray-900">{totalRecipients}</div>
                    <div className="text-xs text-gray-600">Total</div>
                </div>
                <div className="bg-green-50 rounded p-2">
                    <div className="text-lg font-bold text-green-700">{signedRecipients}</div>
                    <div className="text-xs text-green-600">Signed</div>
                </div>
                <div className="bg-orange-50 rounded p-2">
                    <div className="text-lg font-bold text-orange-700">{totalRecipients - signedRecipients}</div>
                    <div className="text-xs text-orange-600">Pending</div>
                </div>
            </div>
        </div>
    );
};