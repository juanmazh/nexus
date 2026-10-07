import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import type { Task } from "./api";

export function makeTask(overrides: Partial<Task> = {}): Task {
	return {
		id: crypto.randomUUID(),
		title: "Una tarea",
		notes: null,
		status: "todo",
		priority: "medium",
		due_at: null,
		completed_at: null,
		created_at: 0,
		updated_at: 0,
		...overrides,
	};
}

export function okJson(body: unknown, status = 200) {
	return { ok: true, status, json: async () => body };
}

export function failJson(message: string, status = 500) {
	return { ok: false, status, json: async () => ({ error: { code: "x", message } }) };
}

export function withQueryClient() {
	const queryClient = new QueryClient({
		defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
	});
	const wrapper = ({ children }: { children: ReactNode }) => (
		<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
	);
	return { queryClient, wrapper };
}
