import { and, asc, eq, lte, sql } from "drizzle-orm";
import type { AnyD1Database } from "drizzle-orm/d1";
import { createDb } from "../db/client";
import { reminders, tasks } from "../db/schema";
import {
	buildReminderMessage,
	sendTelegramMessage,
	type TelegramBindings,
	telegramConfig,
} from "../integrations/telegram";

/**
 * The job the Cron Trigger runs every 5 minutes (`docs/ARCHITECTURE.md §3.3`,
 * add-reminders design.md D7): one read, the sends in parallel, one write.
 *
 * Delivery is **at least once** (design.md D9). If Telegram accepts a message
 * and the write that follows fails, the reminder is still pending and goes out
 * again in five minutes; a duplicate is a nuisance, a lost reminder is the bug
 * this exists to prevent.
 */

/** 1 read + 20 `fetch` + 1 batch = 22 of the 50 subrequests of an invocation. */
export const BATCH_SIZE = 20;
/** Three tries five minutes apart; the third failure is final. */
export const MAX_ATTEMPTS = 3;

export type ReminderJobEnv = TelegramBindings & { DB: AnyD1Database; APP_TIMEZONE?: string };

export type ReminderJobResult =
	| { status: "not_configured"; missing: string[] }
	| { status: "done"; sent: number; retrying: number; failed: number };

export async function runReminders(
	env: ReminderJobEnv,
	now: number,
	fetchImpl: typeof fetch = fetch,
): Promise<ReminderJobResult> {
	const telegram = telegramConfig(env);
	if (!telegram.ok) {
		// Without the secrets nothing is touched: counting this as an attempt would
		// turn a missing `wrangler secret put` into every reminder failing within
		// fifteen minutes. Only the names are logged, never a value.
		console.error(`Recordatorios sin enviar: falta ${telegram.missing.join(" y ")}.`);
		return { status: "not_configured", missing: telegram.missing };
	}

	const db = createDb(env);
	const timezone = env.APP_TIMEZONE ?? "Europe/Madrid";

	const due = await db
		.select({
			id: reminders.id,
			attempts: reminders.attempts,
			title: tasks.title,
			due_at: tasks.due_at,
			priority: tasks.priority,
		})
		.from(reminders)
		.innerJoin(tasks, eq(tasks.id, reminders.task_id))
		.where(and(eq(reminders.status, "pending"), lte(reminders.remind_at, now)))
		.orderBy(asc(reminders.remind_at))
		.limit(BATCH_SIZE)
		.all();

	if (due.length === 0) {
		return { status: "done", sent: 0, retrying: 0, failed: 0 };
	}

	// Waiting for the network costs no CPU time, and in parallel the invocation
	// lasts as long as the slowest send instead of the sum of all of them.
	const results = await Promise.allSettled(
		due.map((reminder) =>
			sendTelegramMessage(
				telegram.config,
				buildReminderMessage(reminder, now, timezone),
				fetchImpl,
			),
		),
	);

	let sent = 0;
	let retrying = 0;
	let failed = 0;

	const updates = due.map((reminder, index) => {
		const settled = results[index];
		const outcome =
			settled?.status === "fulfilled"
				? settled.value
				: { ok: false as const, error: "El envío no terminó." };

		// `status = 'pending'` in every WHERE: a reminder cancelled while it was
		// being sent stays cancelled instead of being written over.
		const stillPending = and(eq(reminders.id, reminder.id), eq(reminders.status, "pending"));

		if (outcome.ok) {
			sent++;
			return db
				.update(reminders)
				.set({ status: "sent", sent_at: now, last_error: null })
				.where(stillPending);
		}

		const attempts = reminder.attempts + 1;
		const isFinal = attempts >= MAX_ATTEMPTS;
		if (isFinal) {
			failed++;
		} else {
			retrying++;
		}
		return db
			.update(reminders)
			.set({
				attempts: sql`${reminders.attempts} + 1`,
				last_error: outcome.error,
				status: isFinal ? "failed" : "pending",
			})
			.where(stillPending);
	});

	const [first, ...rest] = updates;
	if (first) {
		await db.batch([first, ...rest]);
	}

	console.log(`Recordatorios: ${sent} enviados, ${retrying} por reintentar, ${failed} fallidos.`);
	return { status: "done", sent, retrying, failed };
}
