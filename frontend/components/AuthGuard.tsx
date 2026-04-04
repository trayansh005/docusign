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

    useEffect(() => {
        if (!isLoading && !user) {
            const loginUrl = `/login?redirect=${encodeURIComponent(pathname)}`;
            router.replace(loginUrl);
        }
    }, [isLoading, user, router, pathname]);

    // Show loading state while checking auth
    if (isLoading) {
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
