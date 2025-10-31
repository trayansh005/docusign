"use client";

import { useState, useEffect } from "react";
import { authAPI } from "@/services/authAPI";
import { Session } from "@/types/auth";
import { handleAuthError } from "@/lib/handleAuthError";

export function SessionManager() {
    const [sessions, setSessions] = useState<Session[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null);
    const [isLoggingOutAll, setIsLoggingOutAll] = useState(false);

    // Fetch sessions on mount
    useEffect(() => {
        loadSessions();
    }, []);

    const loadSessions = async () => {
        setIsLoading(true);
        setError(null);

        try {
            const result = await authAPI.getSessions();

            if (result.success && result.sessions) {
                setSessions(result.sessions);
            } else {
                setError("Failed to load sessions");
            }
        } catch (err) {
            // Handle 401 errors (session expired)
            if (handleAuthError(err)) {
                return; // Error handler will redirect to login
            }
            console.error("Error loading sessions:", err);
            setError("An error occurred while loading sessions");
        } finally {
            setIsLoading(false);
        }
    };

    const handleDeleteSession = async (sessionId: string) => {
        if (!confirm("Are you sure you want to log out from this device?")) {
            return;
        }

        setDeletingSessionId(sessionId);
        setError(null);

        try {
            const result = await authAPI.deleteSession(sessionId);

            if (result.success) {
                // Remove the session from the list
                setSessions((prev) => prev.filter((s) => s.id !== sessionId));
            } else {
                setError(result.message || "Failed to delete session");
            }
        } catch (err) {
            // Handle 401 errors (session expired)
            if (handleAuthError(err)) {
                return; // Error handler will redirect to login
            }
            console.error("Error deleting session:", err);
            setError("An error occurred while deleting the session");
        } finally {
            setDeletingSessionId(null);
        }
    };

    const handleLogoutAll = async () => {
        if (
            !confirm(
                "Are you sure you want to log out from all devices? You will be logged out from this device as well."
            )
        ) {
            return;
        }

        setIsLoggingOutAll(true);
        setError(null);

        try {
            const result = await authAPI.logoutAll();

            if (result.success) {
                // Redirect to login page after successful logout
                window.location.href = "/login";
            } else {
                setError(result.message || "Failed to logout from all devices");
            }
        } catch (err) {
            // Handle 401 errors (session expired)
            if (handleAuthError(err)) {
                return; // Error handler will redirect to login
            }
            console.error("Error logging out from all devices:", err);
            setError("An error occurred while logging out from all devices");
        } finally {
            setIsLoggingOutAll(false);
        }
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) {
            return "Just now";
        } else if (diffMins < 60) {
            return `${diffMins} minute${diffMins > 1 ? "s" : ""} ago`;
        } else if (diffHours < 24) {
            return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
        } else if (diffDays < 7) {
            return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
        } else {
            return date.toLocaleDateString();
        }
    };

    const getDeviceIcon = (deviceName: string) => {
        const lowerDevice = deviceName.toLowerCase();

        if (lowerDevice.includes("iphone") || lowerDevice.includes("android")) {
            return (
                <svg
                    className="w-6 h-6 text-blue-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"
                    />
                </svg>
            );
        } else if (lowerDevice.includes("ipad") || lowerDevice.includes("tablet")) {
            return (
                <svg
                    className="w-6 h-6 text-blue-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 18h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                    />
                </svg>
            );
        } else {
            return (
                <svg
                    className="w-6 h-6 text-blue-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                    />
                </svg>
            );
        }
    };

    if (isLoading) {
        return (
            <div className="bg-gray-900 border border-gray-700 rounded-lg p-8">
                <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
                </div>
                <p className="text-center text-gray-400 mt-4">Loading sessions...</p>
            </div>
        );
    }

    return (
        <div className="bg-gray-900 border border-gray-700 rounded-lg">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-700 flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-semibold text-white">Active Sessions</h2>
                    <p className="text-sm text-gray-400 mt-1">
                        Manage your active sessions across all devices
                    </p>
                </div>
                {sessions.length > 1 && (
                    <button
                        onClick={handleLogoutAll}
                        disabled={isLoggingOutAll}
                        className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-800 disabled:cursor-not-allowed text-white rounded-lg transition-colors text-sm font-medium"
                    >
                        {isLoggingOutAll ? (
                            <span className="flex items-center gap-2">
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                Logging out...
                            </span>
                        ) : (
                            "Logout All Devices"
                        )}
                    </button>
                )}
            </div>

            {/* Error Message */}
            {error && (
                <div className="mx-6 mt-4 px-4 py-3 bg-red-500/10 border border-red-500/50 rounded-lg">
                    <p className="text-red-400 text-sm">{error}</p>
                </div>
            )}

            {/* Sessions List */}
            <div className="divide-y divide-gray-700">
                {sessions.length === 0 ? (
                    <div className="px-6 py-12 text-center">
                        <svg
                            className="w-16 h-16 text-gray-600 mx-auto mb-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                            />
                        </svg>
                        <p className="text-gray-400">No active sessions found</p>
                    </div>
                ) : (
                    sessions.map((session) => (
                        <div
                            key={session.id}
                            className={`px-6 py-4 ${session.isCurrentSession ? "bg-blue-500/5" : ""
                                }`}
                        >
                            <div className="flex items-start justify-between gap-4">
                                {/* Device Info */}
                                <div className="flex items-start gap-4 flex-1 min-w-0">
                                    {/* Device Icon */}
                                    <div className="flex-shrink-0 mt-1">
                                        {getDeviceIcon(session.deviceInfo.deviceName)}
                                    </div>

                                    {/* Device Details */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <h3 className="text-white font-medium">
                                                {session.deviceInfo.deviceName}
                                            </h3>
                                            {session.isCurrentSession && (
                                                <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs font-medium rounded">
                                                    Current Session
                                                </span>
                                            )}
                                        </div>

                                        <div className="mt-2 space-y-1">
                                            <p className="text-sm text-gray-400">
                                                <span className="text-gray-500">IP Address:</span>{" "}
                                                {session.deviceInfo.ip}
                                            </p>
                                            <p className="text-sm text-gray-400">
                                                <span className="text-gray-500">Last Active:</span>{" "}
                                                {formatDate(session.lastActivity)}
                                            </p>
                                            <p className="text-sm text-gray-400">
                                                <span className="text-gray-500">Signed In:</span>{" "}
                                                {formatDate(session.createdAt)}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* Delete Button */}
                                {!session.isCurrentSession && (
                                    <button
                                        onClick={() => handleDeleteSession(session.id)}
                                        disabled={deletingSessionId === session.id}
                                        className="flex-shrink-0 px-3 py-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 disabled:text-red-600 disabled:cursor-not-allowed rounded-lg transition-colors text-sm font-medium"
                                        title="Log out from this device"
                                    >
                                        {deletingSessionId === session.id ? (
                                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-red-400"></div>
                                        ) : (
                                            "Revoke"
                                        )}
                                    </button>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Footer Info */}
            {sessions.length > 0 && (
                <div className="px-6 py-4 border-t border-gray-700 bg-gray-800/50">
                    <p className="text-xs text-gray-400">
                        💡 Sessions automatically expire after 7 days of inactivity. You can revoke
                        access from any device at any time.
                    </p>
                </div>
            )}
        </div>
    );
}
