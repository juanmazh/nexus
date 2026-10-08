import { zonedDayNumber } from "@shared/dates";
import { formatShortDate } from "@shared/format";
import { describeInterval, type RepeatUnit } from "@shared/recurrence";

/**
 * The smallest client of the Telegram Bot API that Nexus needs: `sendMessage`,
 * in plain text, and errors that can be stored and shown without leaking the
 * token (add-reminders design.md D8).
 *
 * The token travels **inside the URL** (`/bot<token>/sendMessage`), so anything
 * that prints the URL prints the secret. No error message here is ever built
 * from the URL, and every one of them is cleaned of the token anyway, in case
 * the runtime puts the URL in a network error.
 */

export type TelegramConfig = { token: string; chatId: string };

/** The secrets as the Worker sees them: absent until `wrangler secret put`. */
export type TelegramBindings = { TELEGRAM_BOT_TOKEN?: string; TELEGRAM_CHAT_ID?: string };

export type TelegramConfigResult =
	| { ok: true; config: TelegramConfig }
	| { ok: false; missing: ("TELEGRAM_BOT_TOKEN" | "TELEGRAM_CHAT_ID")[] };

export type SendResult = { ok: true } | { ok: false; error: string };

/** Enough to say what went wrong; a stored error never needs more. */
export const MAX_ERROR_LENGTH = 500;

const API_ORIGIN = "https://api.telegram.org";

/** Names what is missing, never what is there. */
export function telegramConfig(env: TelegramBindings): TelegramConfigResult {
	const token = env.TELEGRAM_BOT_TOKEN?.trim();
	const chatId = env.TELEGRAM_CHAT_ID?.trim();
	if (token && chatId) {
		return { ok: true, config: { token, chatId } };
	}
	return {
		ok: false,
		missing: [
			...(token ? [] : ["TELEGRAM_BOT_TOKEN" as const]),
			...(chatId ? [] : ["TELEGRAM_CHAT_ID" as const]),
		],
	};
}

/** Removes every appearance of the token and caps the length. */
export function sanitizeError(message: string, token: string): string {
	const clean = token ? message.split(token).join("<token>") : message;
	return clean.length > MAX_ERROR_LENGTH ? `${clean.slice(0, MAX_ERROR_LENGTH - 1)}…` : clean;
}

/**
 * Sends `text` as it is: no `parse_mode`, so a title with `_`, `*` or `<` cannot
 * make Telegram reject the message. Anything that is not a 2xx with `ok: true`
 * is a failure, and so is a network error; the caller decides what a failure
 * costs (design.md D7).
 */
export async function sendTelegramMessage(
	config: TelegramConfig,
	text: string,
	fetchImpl: typeof fetch = fetch,
): Promise<SendResult> {
	try {
		const response = await fetchImpl(`${API_ORIGIN}/bot${config.token}/sendMessage`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				chat_id: config.chatId,
				text,
				link_preview_options: { is_disabled: true },
			}),
		});
		const body = (await response.json().catch(() => null)) as {
			ok?: boolean;
			description?: string;
		} | null;

		if (response.ok && body?.ok === true) {
			return { ok: true };
		}
		const description = body?.description ?? "respuesta sin descripción";
		return {
			ok: false,
			error: sanitizeError(`Telegram respondió ${response.status}: ${description}`, config.token),
		};
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		return { ok: false, error: sanitizeError(`Error de red: ${message}`, config.token) };
	}
}

export type ReminderSubject = {
	title: string;
	due_at: number | null;
	priority: "low" | "medium" | "high";
	/** Only on recurring reminders (add-recurring-reminders design.md D5). */
	repeat?: { every: number; unit: RepeatUnit } | null;
};

/**
 * The text of a reminder: the title, the due date when there is one ("hoy" when
 * it is today) and the priority only when it is high, one per line.
 */
export function buildReminderMessage(task: ReminderSubject, now: number, tz: string): string {
	const lines = [task.repeat ? `🔁 No te olvides: ${task.title}` : `⏰ ${task.title}`];
	if (task.due_at !== null) {
		const isToday = zonedDayNumber(task.due_at, tz) === zonedDayNumber(now, tz);
		lines.push(`Vence: ${isToday ? "hoy" : formatShortDate(task.due_at, tz)}`);
	}
	if (task.priority === "high") {
		lines.push("Prioridad alta");
	}
	if (task.repeat) {
		lines.push(`Se repite ${describeInterval(task.repeat.every, task.repeat.unit)}`);
	}
	return lines.join("\n");
}

export const TEST_MESSAGE =
	"✅ Nexus: aviso de prueba. Si lees esto, los recordatorios llegarán aquí.";
