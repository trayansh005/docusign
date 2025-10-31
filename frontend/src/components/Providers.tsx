"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { handleQueryError } from "@/lib/queryErrorHandler";

export function Providers({ children }: { children: React.ReactNode }) {
	const [queryClient] = useState(
		() =>
			new QueryClient({
				defaultOptions: {
					queries: {
						staleTime: 60 * 1000, // 1 minute
						gcTime: 10 * 60 * 1000, // 10 minutes
						retry: (failureCount, error) => {
							// Don't retry on auth errors
							if (error instanceof Error && error.message.startsWith("AUTH_REQUIRED:")) {
								handleQueryError(error);
								return false;
							}
							// Retry other errors up to 3 times
							return failureCount < 3;
						},
					},
					mutations: {
						retry: false,
						onError: handleQueryError,
					},
				},
			})
	);

	return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
