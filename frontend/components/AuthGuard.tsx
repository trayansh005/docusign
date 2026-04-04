"use client";

// Auth protection is handled entirely by proxy.ts (server-side).
// This component is kept as a passthrough wrapper for backwards compatibility.
export function AuthGuard({ children }: { children: React.ReactNode }) {
	return <>{children}</>;
}
