import type { CreateReminderInput, QuietHoursInput } from "@shared/reminders";
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

/**
 * `remind_at` is a wall-clock time of Madrid, `YYYY-MM-DDTHH:mm`; with `repeat`
 * it is the first occurrence of a recurring reminder.
 */
export async function createReminder(
	taskId: string,
	input: CreateReminderInput,
): Promise<Reminder> {
	const response = await client.api.tasks[":id"].reminders.$post({
		param: { id: taskId },
		json: input,
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

/** The quiet hours of recurring reminders; `null` when they are turned off. */
export async function fetchQuietHours(): Promise<QuietHoursInput> {
	const response = await client.api.settings["quiet-hours"].$get();
	if (!response.ok) {
		throw await failure(response);
	}
	return response.json();
}

export async function saveQuietHours(quiet: QuietHoursInput): Promise<QuietHoursInput> {
	const response = await client.api.settings["quiet-hours"].$put({ json: quiet });
	if (!response.ok) {
		throw await failure(response);
	}
	return response.json();
}
