import type { InferRequestType, InferResponseType } from "hono/client";
import { client } from "@/lib/api";

/**
 * One function per endpoint over the typed RPC client, never a bare `fetch`
 * (ADR-007). The types come from the Worker's route chain, so a change in the
 * contract breaks this file's typecheck instead of the screen.
 */

type ListCall = typeof client.api.tasks.$get;
type CreateCall = typeof client.api.tasks.$post;
type UpdateCall = (typeof client.api.tasks)[":id"]["$patch"];

/** A task as the list returns it, with the instant of its next pending reminder. */
export type Task = InferResponseType<ListCall, 200>[number];
/**
 * A task as creating or editing returns it: the plain row, without
 * `next_reminder_at` (add-reminders design.md D6). The hooks keep the value the
 * cache already had.
 */
export type SavedTask = InferResponseType<CreateCall, 201>;
export type TaskListStatus = NonNullable<InferRequestType<ListCall>["query"]["status"]>;
export type CreateTaskBody = InferRequestType<CreateCall>["json"];
export type UpdateTaskBody = InferRequestType<UpdateCall>["json"];

/**
 * The RPC client resolves on 4xx and 5xx too. This turns any non-2xx into an
 * error carrying the message the API wrote for the person, so a hook can show it
 * as it is.
 */
export class ApiError extends Error {
	constructor(
		readonly status: number,
		message: string,
	) {
		super(message);
		this.name = "ApiError";
	}
}

async function failure(response: Response): Promise<ApiError> {
	const body = (await response.json().catch(() => null)) as {
		error?: { message?: string };
	} | null;
	return new ApiError(
		response.status,
		body?.error?.message ?? "No se ha podido completar la acción.",
	);
}

export async function fetchTasks(status: TaskListStatus): Promise<Task[]> {
	const response = await client.api.tasks.$get({ query: { status } });
	if (!response.ok) {
		throw await failure(response);
	}
	return response.json();
}

export async function createTask(body: CreateTaskBody): Promise<SavedTask> {
	const response = await client.api.tasks.$post({ json: body });
	if (!response.ok) {
		throw await failure(response);
	}
	return response.json();
}

export async function updateTask(id: string, body: UpdateTaskBody): Promise<SavedTask> {
	const response = await client.api.tasks[":id"].$patch({ param: { id }, json: body });
	if (!response.ok) {
		throw await failure(response);
	}
	return response.json();
}

export async function deleteTask(id: string): Promise<void> {
	const response = await client.api.tasks[":id"].$delete({ param: { id } });
	if (!response.ok) {
		throw await failure(response);
	}
}
