"use client";

import { useEffect } from "react";
import { useAuthStore } from "@/stores/authStore";
import { cleanupOldAuthData } from "@/lib/cleanupOldAuth";

export function AuthInitializer() {
	const initialize = useAuthStore((state) => state.initialize);

	useEffect(() => {
		// Clean up any old localStorage auth data first
		cleanupOldAuthData();

		// Then initialize auth from cookies
		initialize();
	}, [initialize]);

	return null;
}
