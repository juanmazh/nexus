import type { InferResponseType } from "hono/client";
import { client } from "@/lib/api";
import { failure } from "@/lib/api-error";

/**
 * One function per endpoint over the typed RPC client (ADR-007). The types come
 * from the Worker's routes, never written by hand.
 */

type ListCall = (typeof client.api.tasks)[":id"]["reminders"]["$get"];

export type Reminder = InferResponseType<ListCall, 200>[number];

export async function fetchReminders(taskId: string): Promise<Reminder[]> {
	const response = await client.api.tasks[":id"].reminders.$get({ param: { id: taskId } });
	if (!response.ok) {
		throw await failure(response);
	}
	return response.json();
}

/** `remindAt` is a wall-clock time of Madrid, `YYYY-MM-DDTHH:mm`. */
export async function createReminder(taskId: string, remindAt: string): Promise<Reminder> {
	const response = await client.api.tasks[":id"].reminders.$post({
		param: { id: taskId },
		json: { remind_at: remindAt },
	});
	if (!response.ok) {
		throw await failure(response);
	}
	return response.json();
}

export async function cancelReminder(id: string): Promise<void> {
	const response = await client.api.reminders[":id"].$delete({ param: { id } });
	if (!response.ok) {
		throw await failure(response);
	}
}

export async function sendTestMessage(): Promise<void> {
	const response = await client.api.telegram.test.$post();
	if (!response.ok) {
		throw await failure(response);
	}
}
