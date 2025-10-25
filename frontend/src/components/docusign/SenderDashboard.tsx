"use client";

import React, { useState, useEffect } from "react";
import { Eye, Clock, CheckCircle, AlertCircle, Users, FileText, Calendar } from "lucide-react";
import { DocuSignTemplateData } from "@/types/docusign";
import { SigningProgress } from "./SigningProgress";
import { getTemplates, getSigningProgress } from "@/services/docusignAPI";
import { useAuthStore } from "@/stores/authStore";

interface DocumentWithProgress extends DocuSignTemplateData {
    progress?: {
        totalRecipients: number;
        signedRecipients: number;
        completionPercentage: number;
        nextRecipient: {
            id: string;
            name: string;
            email: string;
            signingOrder: number;
        } | null;
        isComplete: boolean;
    };
}

export const SenderDashboard: React.FC = () => {
    const user = useAuthStore((state) => state.user);
    const [documents, setDocuments] = useState<DocumentWithProgress[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedDocument, setSelectedDocument] = useState<DocumentWithProgress | null>(null);
    const [filter, setFilter] = useState<"all" | "pending" | "completed">("all");

    useEffect(() => {
        loadDocuments();
    }, []);

    const loadDocuments = async () => {
        try {
            setLoading(true);
            const response = await getTemplates({ limit: 50 });

            console.log("=== SenderDashboard Debug ===");
            console.log("Total documents loaded:", response.data.length);
            console.log("Full response:", response);

            // Debug each document
            response.data.forEach((doc, index) => {
                console.log(`Document ${index + 1}: ${doc.name}`);
                console.log("  - Has recipients?", !!doc.recipients);
                console.log("  - Recipients count:", doc.recipients?.length || 0);
                console.log("  - Recipients data:", doc.recipients);
            });

            // Calculate progress directly from recipients data
            const documentsWithProgress = response.data.map((doc) => {
                if (doc.recipients && doc.recipients.length > 0) {
                    const totalRecipients = doc.recipients.length;
                    const signedRecipients = doc.recipients.filter(r => r.signatureStatus === "signed").length;
                    const completionPercentage = totalRecipients > 0 ? Math.round((signedRecipients / totalRecipients) * 100) : 0;

                    // Find next recipient to sign
                    const sortedRecipients = [...doc.recipients].sort((a, b) => a.signingOrder - b.signingOrder);
                    const nextRecipient = sortedRecipients.find(r => r.signatureStatus === "pending");

                    const progress = {
                        totalRecipients,
                        signedRecipients,
                        completionPercentage,
                        nextRecipient: nextRecipient ? {
                            id: nextRecipient.id,
                            name: nextRecipient.name,
                            email: nextRecipient.email,
                            signingOrder: nextRecipient.signingOrder,
                        } : null,
                        isComplete: signedRecipients === totalRecipients,
                    };

                    console.log(`Progress for ${doc.name}:`, progress);
                    return { ...doc, progress };
                }
                return doc;
            });

            setDocuments(documentsWithProgress);
        } catch (error) {
            console.error("Failed to load documents:", error);
        } finally {
            setLoading(false);
        }
    };

    const getStatusIcon = (doc: DocumentWithProgress) => {
        if (!doc.recipients || doc.recipients.length === 0) {
            return <FileText className="w-5 h-5 text-gray-400" />;
        }

        if (doc.progress?.isComplete) {
            return <CheckCircle className="w-5 h-5 text-green-600" />;
        }

        if (doc.progress && doc.progress.signedRecipients > 0) {
            return <Clock className="w-5 h-5 text-blue-600" />;
        }

        return <AlertCircle className="w-5 h-5 text-orange-600" />;
    };

    const getStatusText = (doc: DocumentWithProgress) => {
        if (!doc.recipients || doc.recipients.length === 0) {
            return "No recipients";
        }

        if (doc.progress?.isComplete) {
            return "Completed";
        }

        if (doc.progress) {
            return `${doc.progress.signedRecipients}/${doc.progress.totalRecipients} signed`;
        }

        return "Pending";
    };

    const filteredDocuments = documents.filter((doc) => {
        if (filter === "all") return true;
        if (filter === "completed") return doc.progress?.isComplete;
        if (filter === "pending") return !doc.progress?.isComplete && doc.recipients && doc.recipients.length > 0;
        return true;
    });

    const stats = {
        total: documents.length,
        pending: documents.filter(d => !d.progress?.isComplete && d.recipients && d.recipients.length > 0).length,
        completed: documents.filter(d => d.progress?.isComplete).length,
        noRecipients: documents.filter(d => !d.recipients || d.recipients.length === 0).length,
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center p-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <span className="ml-2 text-gray-400">Loading documents...</span>
            </div>
        );
    }

    return (
        <div className="min-h-screen py-8 px-4 sm:px-6 lg:px-8">
            <div className="max-w-7xl mx-auto">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-white mb-2">Document Signing Dashboard</h1>
                    <p className="text-gray-400">Track the progress of your sent documents and see who needs to sign next</p>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                    <div className="card p-6">
                        <div className="flex items-center">
                            <div className="p-2 bg-blue-500/20 rounded-lg">
                                <FileText className="w-6 h-6 text-blue-400" />
                            </div>
                            <div className="ml-4">
                                <p className="text-sm font-medium text-gray-400">Total Documents</p>
                                <p className="text-2xl font-bold text-white">{stats.total}</p>
                            </div>
                        </div>
                    </div>

                    <div className="card p-6">
                        <div className="flex items-center">
                            <div className="p-2 bg-orange-500/20 rounded-lg">
                                <Clock className="w-6 h-6 text-orange-400" />
                            </div>
                            <div className="ml-4">
                                <p className="text-sm font-medium text-gray-400">Pending Signatures</p>
                                <p className="text-2xl font-bold text-white">{stats.pending}</p>
                            </div>
                        </div>
                    </div>

                    <div className="card p-6">
                        <div className="flex items-center">
                            <div className="p-2 bg-green-500/20 rounded-lg">
                                <CheckCircle className="w-6 h-6 text-green-400" />
                            </div>
                            <div className="ml-4">
                                <p className="text-sm font-medium text-gray-400">Completed</p>
                                <p className="text-2xl font-bold text-white">{stats.completed}</p>
                            </div>
                        </div>
                    </div>

                    <div className="card p-6">
                        <div className="flex items-center">
                            <div className="p-2 bg-purple-500/20 rounded-lg">
                                <Users className="w-6 h-6 text-purple-400" />
                            </div>
                            <div className="ml-4">
                                <p className="text-sm font-medium text-gray-400">Draft Documents</p>
                                <p className="text-2xl font-bold text-white">{stats.noRecipients}</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Filter Tabs */}
                <div className="mb-6">
                    <div className="border-b border-gray-700">
                        <nav className="-mb-px flex space-x-8">
                            {[
                                { key: "all", label: "All Documents", count: stats.total },
                                { key: "pending", label: "Pending Signatures", count: stats.pending },
                                { key: "completed", label: "Completed", count: stats.completed },
                            ].map((tab) => (
                                <button
                                    key={tab.key}
                                    onClick={() => setFilter(tab.key as any)}
                                    className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${filter === tab.key
                                        ? "border-blue-500 text-blue-400"
                                        : "border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-600"
                                        }`}
                                >
                                    {tab.label} ({tab.count})
                                </button>
                            ))}
                        </nav>
                    </div>
                </div>

                {/* Documents List */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {filteredDocuments.map((doc) => (
                        <div
                            key={doc._id}
                            className="card card-hover cursor-pointer"
                            onClick={() => setSelectedDocument(doc)}
                        >
                            <div className="p-6">
                                <div className="flex items-start justify-between mb-4">
                                    <div className="flex items-center flex-1 min-w-0">
                                        {getStatusIcon(doc)}
                                        <div className="ml-3 flex-1 min-w-0">
                                            <h3 className="text-lg font-semibold text-white truncate" title={doc.name}>
                                                {doc.name}
                                            </h3>
                                            <p className="text-sm text-gray-400">
                                                {getStatusText(doc)}
                                            </p>
                                        </div>
                                    </div>
                                    {doc.recipients && doc.recipients.length > 0 && (
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ml-2 flex-shrink-0 ${doc.progress?.isComplete
                                            ? "bg-green-100 text-green-800"
                                            : doc.progress && doc.progress.signedRecipients > 0
                                                ? "bg-blue-100 text-blue-800"
                                                : "bg-orange-100 text-orange-800"
                                            }`}>
                                            {doc.progress?.isComplete ? "Complete" : "In Progress"}
                                        </span>
                                    )}
                                </div>

                                {/* Progress Bar */}
                                {doc.progress && (
                                    <div className="mb-4">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-sm text-gray-400">Progress</span>
                                            <span className="text-sm font-medium text-white">
                                                {doc.progress.completionPercentage}%
                                            </span>
                                        </div>
                                        <div className="w-full bg-gray-700 rounded-full h-2">
                                            <div
                                                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                                                style={{ width: `${doc.progress.completionPercentage}%` }}
                                            ></div>
                                        </div>
                                    </div>
                                )}

                                {/* Recipients Info */}
                                {doc.recipients && doc.recipients.length > 0 && (
                                    <div className="space-y-2">
                                        {/* Next Recipient */}
                                        {doc.progress?.nextRecipient && (
                                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                                                <div className="flex items-center">
                                                    <Clock className="w-4 h-4 text-blue-600 flex-shrink-0" />
                                                    <div className="ml-2 flex-1 min-w-0">
                                                        <span className="text-sm font-medium text-blue-900">
                                                            Next: {doc.progress.nextRecipient.name}
                                                        </span>
                                                        <p className="text-xs text-blue-700 truncate">
                                                            {doc.progress.nextRecipient.email}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* Recipient List Preview */}
                                        {doc.recipients.length > 0 && (
                                            <div className="bg-gray-800/30 border border-gray-700 rounded-lg p-3">
                                                <div className="text-xs font-medium text-gray-300 mb-2">Recipients:</div>
                                                <div className="space-y-1">
                                                    {doc.recipients.slice(0, 3).map((recipient, idx) => (
                                                        <div key={recipient.id} className="flex items-center text-xs">
                                                            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-white text-xs font-medium mr-2 flex-shrink-0 ${recipient.signatureStatus === "signed"
                                                                ? "bg-green-500"
                                                                : recipient.signatureStatus === "pending"
                                                                    ? "bg-blue-500"
                                                                    : "bg-gray-400"
                                                                }`}>
                                                                {recipient.signingOrder}
                                                            </span>
                                                            <span className="text-white truncate flex-1">
                                                                {recipient.name}
                                                            </span>
                                                            {recipient.signatureStatus === "signed" && (
                                                                <CheckCircle className="w-3 h-3 text-green-600 ml-1 flex-shrink-0" />
                                                            )}
                                                        </div>
                                                    ))}
                                                    {doc.recipients.length > 3 && (
                                                        <div className="text-xs text-gray-400 mt-1">
                                                            +{doc.recipients.length - 3} more
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* No Recipients Message */}
                                {(!doc.recipients || doc.recipients.length === 0) && (
                                    <div className="bg-gray-800/30 border border-gray-700 rounded-lg p-3">
                                        <div className="flex items-center justify-center text-gray-400">
                                            <Users className="w-4 h-4 mr-2" />
                                            <span className="text-sm">No recipients added yet</span>
                                        </div>
                                    </div>
                                )}

                                {/* Document Info */}
                                <div className="mt-4 flex items-center justify-between text-sm text-gray-400">
                                    <div className="flex items-center">
                                        <Calendar className="w-4 h-4 mr-1" />
                                        {new Date(doc.createdAt).toLocaleDateString()}
                                    </div>
                                    <div className="flex items-center">
                                        <Users className="w-4 h-4 mr-1" />
                                        {doc.recipients?.length || 0} recipients
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {filteredDocuments.length === 0 && (
                    <div className="text-center py-12">
                        <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-white mb-2">No documents found</h3>
                        <p className="text-gray-400">
                            {filter === "all"
                                ? "You haven't created any documents yet."
                                : `No ${filter} documents found.`
                            }
                        </p>
                    </div>
                )}

                {/* Document Detail Modal */}
                {selectedDocument && (
                    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
                        <div className="card max-w-2xl w-full max-h-[80vh] overflow-y-auto">
                            <div className="p-6">
                                <div className="flex items-center justify-between mb-6">
                                    <h2 className="text-xl font-semibold text-white">
                                        {selectedDocument.name}
                                    </h2>
                                    <button
                                        onClick={() => setSelectedDocument(null)}
                                        className="text-gray-400 hover:text-white transition-colors"
                                    >
                                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </button>
                                </div>

                                {selectedDocument.recipients && selectedDocument.recipients.length > 0 ? (
                                    <SigningProgress
                                        recipients={selectedDocument.recipients}
                                        currentUserEmail={user?.email}
                                    />
                                ) : (
                                    <div className="text-center py-8">
                                        <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                                        <h3 className="text-lg font-medium text-white mb-2">No Recipients</h3>
                                        <p className="text-gray-400">This document hasn't been sent to anyone yet.</p>
                                    </div>
                                )}

                                <div className="mt-6 flex justify-end">
                                    <button
                                        onClick={() => setSelectedDocument(null)}
                                        className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
                                    >
                                        Close
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};