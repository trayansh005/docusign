"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuthStore } from "@/stores/authStore";
import { SessionManager } from "@/components/SessionManager";

export default function SessionsPage() {
    const user = useAuthStore((state) => state.user);
    const isLoading = useAuthStore((state) => state.isLoading);
    const router = useRouter();

    // Auth guard - redirect to login if not authenticated
    useEffect(() => {
        if (!isLoading && !user) {
            router.replace("/login");
        }
    }, [user, isLoading, router]);

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500"></div>
            </div>
        );
    }

    if (!user) {
        return null;
    }

    return (
        <div className="min-h-screen py-8 px-4 sm:px-6 lg:px-8">
            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-3xl font-bold text-white mb-2">Session Management</h1>
                            <p className="text-gray-400">
                                View and manage your active sessions across all devices
                            </p>
                        </div>
                        <Link href="/dashboard" className="btn btn-secondary">
                            ← Back to Dashboard
                        </Link>
                    </div>
                </div>

                {/* Session Manager Component */}
                <SessionManager />

                {/* Additional Information */}
                <div className="mt-8 bg-gray-900 border border-gray-700 rounded-lg p-6">
                    <h2 className="text-lg font-semibold text-white mb-4">About Sessions</h2>
                    <div className="space-y-3 text-sm text-gray-400">
                        <div className="flex items-start gap-3">
                            <svg
                                className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                                />
                            </svg>
                            <p>
                                Sessions are created when you log in from a device. Each session is
                                independent and can be managed separately.
                            </p>
                        </div>
                        <div className="flex items-start gap-3">
                            <svg
                                className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                                />
                            </svg>
                            <p>
                                Sessions automatically expire after 7 days of inactivity. Active sessions
                                are extended with each request you make.
                            </p>
                        </div>
                        <div className="flex items-start gap-3">
                            <svg
                                className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                                />
                            </svg>
                            <p>
                                If you notice any suspicious activity or unfamiliar devices, you can
                                immediately revoke access by logging out from that device or all devices.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
