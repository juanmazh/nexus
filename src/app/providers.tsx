import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			// This page only shows the latest result, so refetching on focus just
			// costs Worker invocations from the free plan.
			refetchOnWindowFocus: false,
			staleTime: 30_000,
			retry: 1,
		},
	},
});

export function Providers({ children }: { children: ReactNode }) {
	return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
