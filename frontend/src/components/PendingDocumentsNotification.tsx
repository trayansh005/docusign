"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useAuthStore } from "@/stores/authStore";
import { useState, useRef, useEffect } from "react";

interface PendingDocumentsNotificationProps {
    badgeOnly?: boolean;
}

interface InboxItem {
    id: string;
    name: string;
    status: string;
    createdAt?: string;
    updatedAt?: string;
    sender?: string;
    message?: {
        subject?: string;
        body?: string;
    };
    myRecipientInfo?: {
        signatureStatus?: string;
        signedAt?: string;
    };
}

export function PendingDocumentsNotification({ badgeOnly = false }: PendingDocumentsNotificationProps) {
    const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Get pending count
    const { data: countData } = useQuery({
        queryKey: ["pendingDocumentsCount"],
        queryFn: async () => {
            const res = await fetch("/api/dashboard/pending-count", { credentials: "include" });
            if (!res.ok) throw new Error("Failed to fetch pending count");
            const data = await res.json();
            return data.data;
        },
        enabled: isAuthenticated,
        refetchInterval: 60000, // Refetch every minute
    });

    // Get inbox items when dropdown is open
    const { data: inboxData, isLoading } = useQuery({
        queryKey: ["pendingDocumentsList"],
        queryFn: async () => {
            const res = await fetch("/api/dashboard/inbox?page=1&limit=5", { credentials: "include" });
            if (!res.ok) throw new Error("Failed to fetch inbox");
            const data = await res.json();
            return data.data as InboxItem[];
        },
        enabled: isAuthenticated && isOpen,
    });

    const pendingCount = countData?.pendingCount || 0;

    // Close dropdown when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }

        if (isOpen) {
            document.addEventListener("mousedown", handleClickOutside);
            return () => document.removeEventListener("mousedown", handleClickOutside);
        }
    }, [isOpen]);

    if (!isAuthenticated || pendingCount === 0) {
        return null;
    }

    // Badge only version (for use inside other links)
    if (badgeOnly) {
        return (
            <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-xs font-bold text-white bg-red-600 rounded-full">
                {pendingCount > 99 ? "99+" : pendingCount}
            </span>
        );
    }

    // Full version with dropdown
    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="relative inline-flex items-center justify-center p-2 rounded-lg hover:bg-gray-800/50 transition-colors"
                title={`You have ${pendingCount} document${pendingCount > 1 ? "s" : ""} waiting for your signature`}
            >
                {/* Bell Icon */}
                <svg
                    className="w-6 h-6 text-yellow-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                >
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                    />
                </svg>

                {/* Badge with count */}
                <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[20px] h-5 px-1.5 text-xs font-bold text-white bg-red-600 rounded-full border-2 border-gray-900">
                    {pendingCount > 99 ? "99+" : pendingCount}
                </span>
            </button>

            {/* Dropdown Panel */}
            {isOpen && (
                <div className="absolute right-0 mt-2 w-96 bg-gray-900 border border-gray-700 rounded-lg shadow-2xl z-50 max-h-[500px] overflow-hidden flex flex-col">
                    {/* Header */}
                    <div className="px-4 py-3 border-b border-gray-700 flex items-center justify-between">
                        <h3 className="text-white font-semibold">
                            Pending Documents ({pendingCount})
                        </h3>
                        <Link
                            href="/dashboard"
                            className="text-blue-400 hover:text-blue-300 text-sm"
                            onClick={() => setIsOpen(false)}
                        >
                            View All
                        </Link>
                    </div>

                    {/* Content */}
                    <div className="overflow-y-auto flex-1">
                        {isLoading ? (
                            <div className="flex items-center justify-center py-8">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                            </div>
                        ) : inboxData && inboxData.length > 0 ? (
                            <div className="divide-y divide-gray-700">
                                {inboxData.map((item) => (
                                    <Link
                                        key={item.id}
                                        href={`/fomiqsign/sign/${item.id}`}
                                        className="block px-4 py-3 hover:bg-gray-800/50 transition-colors"
                                        onClick={() => setIsOpen(false)}
                                    >
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="flex-1 min-w-0">
                                                <p className="text-white font-medium truncate">{item.name}</p>
                                                {item.sender && (
                                                    <p className="text-gray-400 text-xs mt-1">
                                                        From: {item.sender}
                                                    </p>
                                                )}
                                                {item.message?.subject && (
                                                    <p className="text-gray-400 text-xs mt-1 truncate">
                                                        📧 {item.message.subject}
                                                    </p>
                                                )}
                                                <div className="flex items-center gap-2 mt-2">
                                                    <span
                                                        className={`text-xs px-2 py-0.5 rounded ${item.status === "final"
                                                                ? "bg-green-500/20 text-green-400"
                                                                : item.status === "active"
                                                                    ? "bg-yellow-500/20 text-yellow-400"
                                                                    : "bg-blue-500/20 text-blue-400"
                                                            }`}
                                                    >
                                                        {item.status}
                                                    </span>
                                                    {item.myRecipientInfo?.signatureStatus && (
                                                        <span
                                                            className={`text-xs px-2 py-0.5 rounded ${item.myRecipientInfo.signatureStatus === "signed"
                                                                    ? "bg-green-500/20 text-green-400"
                                                                    : "bg-yellow-500/20 text-yellow-400"
                                                                }`}
                                                        >
                                                            {item.myRecipientInfo.signatureStatus}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <svg
                                                className="w-5 h-5 text-gray-400 flex-shrink-0 mt-1"
                                                fill="none"
                                                stroke="currentColor"
                                                viewBox="0 0 24 24"
                                            >
                                                <path
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    strokeWidth={2}
                                                    d="M9 5l7 7-7 7"
                                                />
                                            </svg>
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        ) : (
                            <div className="px-4 py-8 text-center text-gray-400">
                                <p>No pending documents</p>
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    {inboxData && inboxData.length > 0 && (
                        <div className="px-4 py-3 border-t border-gray-700 bg-gray-800/50">
                            <Link
                                href="/dashboard"
                                className="block text-center text-blue-400 hover:text-blue-300 text-sm font-medium"
                                onClick={() => setIsOpen(false)}
                            >
                                View All Documents →
                            </Link>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
