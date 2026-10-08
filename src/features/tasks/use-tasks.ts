import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/components/toast-host";
import { remindersQueryKey } from "@/features/reminders/use-reminders";
import type { CreateTaskBody, Task, TaskListStatus, UpdateTaskBody } from "./api";
import { createTask, deleteTask, fetchTasks, updateTask } from "./api";

export const tasksQueryKey = (status: TaskListStatus) => ["tasks", status] as const;

const OPTIMISTIC_PREFIX = "pendiente-";

/**
 * A row the API has not confirmed yet. Its id is not a uuid, so any request
 * with it would be a `400`: the row is shown, but cannot be acted on until the
 * real one replaces it.
 */
export function isUnsaved(task: Task): boolean {
	return task.id.startsWith(OPTIMISTIC_PREFIX);
}

/**
 * Two queries when `/tasks` opens: the pending list and the completed one. The
 * second is what lets the toggle say "Hechas (3)" while it is closed; each one
 * walks its own index (design.md D2), and with one person the cost is far from
 * any limit of the free plan.
 */
export function useTasks(status: TaskListStatus) {
	return useQuery({ queryKey: tasksQueryKey(status), queryFn: () => fetchTasks(status) });
}

type Snapshot = { todo: Task[] | undefined; done: Task[] | undefined };

function useListCache() {
	const queryClient = useQueryClient();

	return {
		queryClient,
		async snapshot(): Promise<Snapshot> {
			// Cancel first, so a response already in flight cannot overwrite the
			// optimistic state the moment after it is written.
			await queryClient.cancelQueries({ queryKey: ["tasks"] });
			return {
				todo: queryClient.getQueryData<Task[]>(tasksQueryKey("todo")),
				done: queryClient.getQueryData<Task[]>(tasksQueryKey("done")),
			};
		},
		restore(snapshot: Snapshot | undefined) {
			if (!snapshot) {
				return;
			}
			queryClient.setQueryData(tasksQueryKey("todo"), snapshot.todo);
			queryClient.setQueryData(tasksQueryKey("done"), snapshot.done);
		},
		set(status: TaskListStatus, update: (list: Task[]) => Task[]) {
			queryClient.setQueryData<Task[]>(tasksQueryKey(status), (list) =>
				list ? update(list) : list,
			);
		},
		refresh() {
			return queryClient.invalidateQueries({ queryKey: ["tasks"] });
		},
	};
}

/** The list stays as the API ordered it; a new task without a date belongs at the end. */
function appendPending(list: Task[], task: Task): Task[] {
	return [...list, task];
}

/**
 * Creation from the capture bar: the row appears before the API answers, and if
 * the API fails the row goes away, a notice says so and the caller gets the
 * rejection to give the text back to the bar (design.md D10).
 */
export function useCreateTask() {
	const cache = useListCache();

	return useMutation({
		mutationFn: (body: CreateTaskBody) => createTask(body),
		async onMutate(body) {
			const snapshot = await cache.snapshot();
			const now = Date.now();
			const optimistic: Task = {
				id: `${OPTIMISTIC_PREFIX}${crypto.randomUUID()}`,
				title: body.title.trim(),
				notes: body.notes ?? null,
				status: "todo",
				priority: body.priority ?? "medium",
				due_at: null,
				completed_at: null,
				created_at: now,
				updated_at: now,
				next_reminder_at: null,
			};
			cache.set("todo", (list) => appendPending(list, optimistic));
			return { snapshot, optimisticId: optimistic.id };
		},
		onSuccess(saved, _body, context) {
			// Swap in the real row right away, so it can be completed or opened
			// without waiting for the refetch below.
			cache.set("todo", (list) =>
				list.map((task) =>
					task.id === context?.optimisticId ? { ...saved, next_reminder_at: null } : task,
				),
			);
		},
		onError(error, _body, context) {
			cache.restore(context?.snapshot);
			toast.add({
				title: "No se ha podido guardar la tarea",
				description: error instanceof Error ? error.message : undefined,
			});
		},
		onSettled() {
			return cache.refresh();
		},
	});
}

/** Completing and undoing: the row moves between the two lists at once. */
export function useSetTaskStatus() {
	const cache = useListCache();

	return useMutation({
		mutationFn: ({ task, status }: { task: Task; status: "todo" | "done" }) =>
			updateTask(task.id, { status }),
		async onMutate({ task, status }) {
			const snapshot = await cache.snapshot();
			const moved: Task = {
				...task,
				status,
				completed_at: status === "done" ? (task.completed_at ?? Date.now()) : null,
				// Completing cancels its reminders on the server, and undoing does not
				// bring them back (add-reminders design.md D5): the bell goes either way.
				next_reminder_at: null,
			};
			const from = status === "done" ? "todo" : "done";
			cache.set(from, (list) => list.filter((item) => item.id !== task.id));
			cache.set(status, (list) => (status === "done" ? [moved, ...list] : [...list, moved]));
			return { snapshot };
		},
		onError(_error, { status }, context) {
			cache.restore(context?.snapshot);
			toast.add({
				title:
					status === "done"
						? "No se ha podido completar la tarea"
						: "No se ha podido deshacer la tarea",
			});
		},
		onSettled(_data, _error, { task }) {
			// Completing cancelled the task's reminders on the server. Without this,
			// a detail reopened within the stale time would still list them as
			// pending, and a reminder that will never arrive looks like it will.
			return Promise.all([
				cache.refresh(),
				cache.queryClient.invalidateQueries({ queryKey: remindersQueryKey(task.id) }),
			]);
		},
	});
}

/** The detail's "Guardar": the API answers with the row, which replaces the cached one. */
export function useUpdateTask() {
	const cache = useListCache();

	return useMutation({
		mutationFn: ({ id, body }: { id: string; body: UpdateTaskBody }) => updateTask(id, body),
		onSuccess(saved) {
			// Editing never touches the reminders, so the bell keeps what it had.
			cache.set(saved.status, (list) =>
				list.map((item) =>
					item.id === saved.id ? { ...saved, next_reminder_at: item.next_reminder_at } : item,
				),
			);
			toast.add({ title: "Tarea guardada" });
		},
		onSettled() {
			return cache.refresh();
		},
	});
}

export function useDeleteTask() {
	const cache = useListCache();

	return useMutation({
		mutationFn: (task: Task) => deleteTask(task.id),
		async onMutate(task) {
			const snapshot = await cache.snapshot();
			cache.set(task.status, (list) => list.filter((item) => item.id !== task.id));
			return { snapshot };
		},
		onSuccess() {
			toast.add({ title: "Tarea borrada" });
		},
		onError(_error, _task, context) {
			cache.restore(context?.snapshot);
			toast.add({ title: "No se ha podido borrar la tarea" });
		},
		onSettled() {
			return cache.refresh();
		},
	});
}
