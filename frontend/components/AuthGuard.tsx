"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuthStore } from "@/stores/authStore";

interface AuthGuardProps {
    children: React.ReactNode;
}

/**
 * Client-side auth guard component
 * Redirects to login if not authenticated
 */
export function AuthGuard({ children }: AuthGuardProps) {
    const router = useRouter();
    const pathname = usePathname();
    const user = useAuthStore((state) => state.user);
    const isLoading = useAuthStore((state) => state.isLoading);
    const isInitialized = useAuthStore((state) => state.isInitialized);

    useEffect(() => {
        // Wait until initialization is complete before deciding to redirect.
        // Without this check, isLoading=false + user=null on first render
        // causes an immediate redirect before getProfile has even been called.
        if (isInitialized && !isLoading && !user) {
            const loginUrl = `/login?redirect=${encodeURIComponent(pathname)}`;
            router.replace(loginUrl);
        }
    }, [isInitialized, isLoading, user, router, pathname]);

    // Show loading state while session is being checked
    if (!isInitialized || isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
                    <p className="mt-4 text-gray-400">Loading...</p>
                </div>
            </div>
        );
    }

    // Don't render children if not authenticated (will redirect)
    if (!user) {
        return null;
    }

    return <>{children}</>;
}
