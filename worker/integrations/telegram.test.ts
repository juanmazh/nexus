import { describe, expect, it, vi } from "vitest";
import {
	buildReminderMessage,
	MAX_ERROR_LENGTH,
	sanitizeError,
	sendTelegramMessage,
	telegramConfig,
} from "./telegram";

/** Fictitious, shaped like a real one so a leak would be recognizable. */
const TOKEN = "123456789:AAFakeTokenForTestsOnly_abcdefghijk";
const CONFIG = { token: TOKEN, chatId: "424242" };
const TZ = "Europe/Madrid";
/** Wednesday 2026-10-07 at 18:00 in Madrid. */
const NOW = Date.UTC(2026, 9, 7, 16, 0);

function reply(status: number, body: unknown): typeof fetch {
	return vi.fn(async () => new Response(JSON.stringify(body), { status })) as typeof fetch;
}

describe("telegramConfig", () => {
	it("names what is missing and never echoes a value", () => {
		expect(telegramConfig({})).toEqual({
			ok: false,
			missing: ["TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID"],
		});
		expect(telegramConfig({ TELEGRAM_BOT_TOKEN: TOKEN, TELEGRAM_CHAT_ID: "  " })).toEqual({
			ok: false,
			missing: ["TELEGRAM_CHAT_ID"],
		});
		expect(telegramConfig({ TELEGRAM_BOT_TOKEN: TOKEN, TELEGRAM_CHAT_ID: "424242" })).toEqual({
			ok: true,
			config: CONFIG,
		});
	});
});

describe("sendTelegramMessage", () => {
	it("posts the text as plain text, with no parse_mode and no link preview", async () => {
		const fetchImpl = reply(200, { ok: true, result: {} });

		const result = await sendTelegramMessage(CONFIG, "⏰ a_b *c* <d>", fetchImpl);

		expect(result).toEqual({ ok: true });
		const [url, init] = vi.mocked(fetchImpl).mock.calls[0] ?? [];
		expect(url).toBe(`https://api.telegram.org/bot${TOKEN}/sendMessage`);
		const body = JSON.parse(String(init?.body));
		expect(body).toEqual({
			chat_id: "424242",
			text: "⏰ a_b *c* <d>",
			link_preview_options: { is_disabled: true },
		});
		expect(body).not.toHaveProperty("parse_mode");
	});

	it("fails on a non-2xx with Telegram's own description", async () => {
		const result = await sendTelegramMessage(
			CONFIG,
			"hola",
			reply(400, { ok: false, description: "Bad Request: chat not found" }),
		);

		expect(result).toEqual({
			ok: false,
			error: "Telegram respondió 400: Bad Request: chat not found",
		});
	});

	it("fails on a 200 whose body says ok: false", async () => {
		const result = await sendTelegramMessage(CONFIG, "hola", reply(200, { ok: false }));

		expect(result.ok).toBe(false);
	});

	it("fails on a network error without letting the token through", async () => {
		const fetchImpl = vi.fn(async () => {
			throw new Error(`fetch failed: https://api.telegram.org/bot${TOKEN}/sendMessage`);
		}) as typeof fetch;

		const result = await sendTelegramMessage(CONFIG, "hola", fetchImpl);

		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.error).not.toContain(TOKEN);
		expect(result.error).toContain("<token>");
	});
});

describe("sanitizeError", () => {
	it("removes every appearance of the token and caps the length", () => {
		const long = `${TOKEN} ${"x".repeat(1_000)} ${TOKEN}`;

		const clean = sanitizeError(long, TOKEN);

		expect(clean).not.toContain(TOKEN);
		expect(clean.length).toBeLessThanOrEqual(MAX_ERROR_LENGTH);
	});
});

describe("buildReminderMessage", () => {
	it("writes the title, the due date and the high priority, one per line", () => {
		const text = buildReminderMessage(
			{ title: "Pagar el alquiler", due_at: Date.UTC(2026, 9, 8, 22, 0), priority: "high" },
			NOW,
			TZ,
		);

		expect(text).toBe("⏰ Pagar el alquiler\nVence: vie 9 oct\nPrioridad alta");
	});

	it("says hoy for a task due today and leaves out a priority that is not high", () => {
		const text = buildReminderMessage(
			{ title: "Llamar al taller", due_at: Date.UTC(2026, 9, 6, 22, 0), priority: "medium" },
			NOW,
			TZ,
		);

		expect(text).toBe("⏰ Llamar al taller\nVence: hoy");
	});

	it("is just the title when there is nothing else to say", () => {
		expect(buildReminderMessage({ title: "Algo", due_at: null, priority: "low" }, NOW, TZ)).toBe(
			"⏰ Algo",
		);
	});
});
