import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { remindersQueryKey } from "@/features/reminders/use-reminders";
import { makeTask, okJson, withQueryClient } from "./test-helpers";
import { tasksQueryKey, useSetTaskStatus } from "./use-tasks";

const api = vi.hoisted(() => ({ $get: vi.fn(), $patch: vi.fn() }));

vi.mock("@/lib/api", () => ({
	client: { api: { tasks: Object.assign({ $get: api.$get }, { ":id": { $patch: api.$patch } }) } },
}));

afterEach(() => {
	api.$get.mockReset();
	api.$patch.mockReset();
});

describe("useSetTaskStatus", () => {
	it("marks the reminders of the task stale, since the server cancelled them", async () => {
		// Without this, a detail reopened within the stale time listed reminders
		// that were already cancelled (add-reminders review).
		const task = makeTask({ id: crypto.randomUUID(), next_reminder_at: Date.now() + 3_600_000 });
		const { queryClient, wrapper } = withQueryClient();
		queryClient.setQueryData(tasksQueryKey("todo"), [task]);
		queryClient.setQueryData(tasksQueryKey("done"), []);
		queryClient.setQueryData(remindersQueryKey(task.id), [{ id: "aviso" }]);
		api.$get.mockResolvedValue(okJson([]));
		api.$patch.mockResolvedValue(okJson({ ...task, status: "done", completed_at: Date.now() }));

		const { result } = renderHook(() => useSetTaskStatus(), { wrapper });
		act(() => {
			result.current.mutate({ task, status: "done" });
		});

		await waitFor(() => expect(result.current.isSuccess).toBe(true));
		await waitFor(() =>
			expect(queryClient.getQueryState(remindersQueryKey(task.id))?.isInvalidated).toBe(true),
		);
		expect(queryClient.getQueryData(tasksQueryKey("done"))).toEqual([
			expect.objectContaining({ id: task.id, next_reminder_at: null }),
		]);
	});
});
