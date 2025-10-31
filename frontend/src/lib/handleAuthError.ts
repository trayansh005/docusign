import { useAuthStore } from "@/stores/authStore";

/**
 * Handle authentication errors (401 responses)
 * Clears user state, redirects to login, and shows appropriate error message
 */
export function handleAuthError(error: unknown, currentPath?: string): boolean {
    let isAuthError = false;

    // Check for AUTH_REQUIRED marker from server actions
    if (error instanceof Error && error.message.startsWith("AUTH_REQUIRED:")) {
        isAuthError = true;
    }

    // Check for 401 status in fetch responses
    if (error instanceof Response && error.status === 401) {
        isAuthError = true;
    }

    // Check for error objects with 401 status
    if (error && typeof error === "object" && "status" in error && error.status === 401) {
        isAuthError = true;
    }

    if (isAuthError) {
        console.log("[Auth] Session expired or invalid (401), clearing state and redirecting to login");

        // Clear user state from auth store
        if (typeof window !== "undefined") {
            try {
                useAuthStore.getState().clearUser();
            } catch (err) {
                console.error("[Auth] Error clearing user state:", err);
            }

            // Redirect to login with current path for post-login redirect
            const redirectPath = currentPath || window.location.pathname;
            const loginUrl = `/login?redirect=${encodeURIComponent(redirectPath)}`;
            window.location.href = loginUrl;
        }

        return true; // Auth error handled
    }

    return false; // Not an auth error
}

/**
 * Wrapper for async functions that automatically handles auth errors
 * Usage: await withAuthErrorHandling(() => getTemplates())
 */
export async function withAuthErrorHandling<T>(
    action: () => Promise<T>,
    currentPath?: string
): Promise<T> {
    try {
        return await action();
    } catch (error) {
        // Check if it's an auth error and handle it
        const isAuthError = handleAuthError(error, currentPath);

        // If it was an auth error, throw a user-friendly message
        if (isAuthError) {
            throw new Error("Your session has expired. Please log in again.");
        }

        // Otherwise, re-throw the original error
        throw error;
    }
}
