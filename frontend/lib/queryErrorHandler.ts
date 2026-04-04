/**
 * Global error handler for React Query
 * Automatically redirects to login on auth errors
 */
export function handleQueryError(error: unknown) {
    if (error instanceof Error && error.message.startsWith("AUTH_REQUIRED:")) {
        console.log("[Query] Authentication required, redirecting to login");

        if (typeof window !== "undefined") {
            const currentPath = window.location.pathname;
            const loginUrl = `/login?redirect=${encodeURIComponent(currentPath)}`;
            window.location.href = loginUrl;
        }
    }
}

/**
 * React Query error handler configuration
 * Add this to your QueryClient defaultOptions
 */
export const queryErrorConfig = {
    queries: {
        retry: (failureCount: number, error: unknown) => {
            // Don't retry on auth errors
            if (error instanceof Error && error.message.startsWith("AUTH_REQUIRED:")) {
                return false;
            }
            // Retry other errors up to 3 times
            return failureCount < 3;
        },
        onError: handleQueryError,
    },
    mutations: {
        retry: false,
        onError: handleQueryError,
    },
};
