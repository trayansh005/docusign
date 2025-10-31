import { usePathname, useRouter } from "next/navigation";
import { useCallback } from "react";

/**
 * Hook to handle authentication errors in components
 * Automatically redirects to login on 401 errors
 */
export function useAuthErrorHandler() {
    const pathname = usePathname();
    const router = useRouter();

    const handleError = useCallback(
        (error: unknown) => {
            if (error instanceof Error && error.message.startsWith("AUTH_REQUIRED:")) {
                console.log("[Auth] Authentication required, redirecting to login");
                const loginUrl = `/login?redirect=${encodeURIComponent(pathname)}`;
                router.push(loginUrl);
                return true; // Auth error handled
            }
            return false; // Not an auth error
        },
        [pathname, router]
    );

    return { handleError };
}

/**
 * Hook to wrap async functions with automatic auth error handling
 * Usage:
 * const withAuth = useWithAuthHandler();
 * const data = await withAuth(() => getTemplates());
 */
export function useWithAuthHandler() {
    const { handleError } = useAuthErrorHandler();

    const withAuth = useCallback(
        async <T,>(action: () => Promise<T>): Promise<T> => {
            try {
                return await action();
            } catch (error) {
                const isAuthError = handleError(error);
                if (isAuthError) {
                    throw new Error("Please log in to continue");
                }
                throw error;
            }
        },
        [handleError]
    );

    return withAuth;
}
