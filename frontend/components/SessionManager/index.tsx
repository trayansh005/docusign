"use client";

import React, { useState, useEffect } from "react";
import apiClient from "@/lib/apiClient";
import { toast } from "sonner";

interface Session {
  _id: string;
  device: string;
  ip: string;
  lastActive: string;
  isCurrent: boolean;
}

export function SessionManager() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchSessions = async () => {
    try {
      setIsLoading(true);
      // Note: This endpoint might not exist yet on the backend, 
      // but we provide the UI structure.
      const response = await apiClient.get<{ success: boolean; data: Session[] }>("/auth/sessions");
      if (response && response.success && Array.isArray(response.data)) {
        setSessions(response.data);
      }
    } catch (error) {
      console.error("Failed to fetch sessions:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, []);

  const handleRevoke = async (sessionId: string) => {
    try {
      const response = await apiClient.delete<{ success: boolean }>(`/auth/sessions/${sessionId}`);
      if (response && response.success) {
        toast.success("Session revoked successfully");
        fetchSessions();
      }
    } catch (error) {
      toast.error("Failed to revoke session");
    }
  };

  const handleRevokeAll = async () => {
    try {
      const response = await apiClient.post<{ success: boolean }>("/auth/logout-all");
      if (response && response.success) {
        toast.success("All other sessions revoked");
        fetchSessions();
      }
    } catch (error) {
      toast.error("Failed to revoke all sessions");
    }
  };

  if (isLoading) {
    return <div className="text-gray-400">Loading sessions...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-white">Active Sessions</h2>
        <button 
          onClick={handleRevokeAll}
          className="text-sm text-red-400 hover:text-red-300 transition-colors"
        >
          Revoke all other sessions
        </button>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="divide-y divide-gray-800">
          {sessions.length > 0 ? (
            sessions.map((session) => (
              <div key={session._id} className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center">
                    <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-white font-medium">{session.device || "Unknown Device"}</p>
                      {session.isCurrent && (
                        <span className="text-[10px] bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full border border-blue-500/30">
                          Current Session
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500">{session.ip} • Last active {new Date(session.lastActive).toLocaleString()}</p>
                  </div>
                </div>
                {!session.isCurrent && (
                  <button
                    onClick={() => handleRevoke(session._id)}
                    className="text-gray-400 hover:text-red-400 transition-colors p-2"
                  >
                    Revoke
                  </button>
                )}
              </div>
            ))
          ) : (
            <div className="p-8 text-center text-gray-500">
              No active sessions found.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
