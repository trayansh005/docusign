/**
 * Cleanup old authentication data from localStorage
 * This should run once on app initialization to remove any legacy tokens
 */
export function cleanupOldAuthData() {
    if (typeof window === "undefined") return;

    try {
        // Remove old token-related items
        const keysToRemove = [
            "accessToken",
            "token",
            "refreshToken",
            "user",
            "auth",
            "authToken",
            "jwt",
        ];

        keysToRemove.forEach((key) => {
            if (localStorage.getItem(key)) {
                console.log(`[Cleanup] Removing old auth data: ${key}`);
                localStorage.removeItem(key);
            }
        });
    } catch (error) {
        console.error("Error cleaning up old auth data:", error);
    }
}
