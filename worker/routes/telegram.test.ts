import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { createApp } from "../app";
import { apiRequest, setUpAccessKeys, signAccessToken, testEnv, testGetKey } from "../test-support";

const { app } = createApp({ getKey: testGetKey });
const TOKEN = "123456789:AAFakeTokenForTestsOnly_abcdefghijk";
let token: string;

function send(bindings: Record<string, string | undefined>, method = "POST") {
	return app.fetch(apiRequest("/api/telegram/test", { method, token }), {
		...testEnv(),
		...bindings,
	});
}

beforeAll(async () => {
	await setUpAccessKeys();
	token = await signAccessToken();
});

afterEach(() => {
	vi.restoreAllMocks();
});

describe("POST /api/telegram/test", () => {
	it("sends the test message and answers 204", async () => {
		const fetchSpy = vi
			.spyOn(globalThis, "fetch")
			.mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));

		const res = await send({ TELEGRAM_BOT_TOKEN: TOKEN, TELEGRAM_CHAT_ID: "424242" });

		expect(res.status).toBe(204);
		const body = JSON.parse(String(fetchSpy.mock.calls[0]?.[1]?.body));
		expect(body.text).toContain("aviso de prueba");
	});

	it("answers 503 naming what is missing, without calling Telegram", async () => {
		const fetchSpy = vi.spyOn(globalThis, "fetch");

		const res = await send({ TELEGRAM_BOT_TOKEN: TOKEN });

		expect(res.status).toBe(503);
		expect(await res.json()).toEqual({
			error: {
				code: "telegram_not_configured",
				message: "Falta configurar TELEGRAM_CHAT_ID en el Worker.",
			},
		});
		expect(fetchSpy).not.toHaveBeenCalled();
	});

	it("answers 502 with Telegram's error and never the token", async () => {
		vi.spyOn(globalThis, "fetch").mockResolvedValue(
			new Response(JSON.stringify({ ok: false, description: `Unauthorized ${TOKEN}` }), {
				status: 401,
			}),
		);

		const res = await send({ TELEGRAM_BOT_TOKEN: TOKEN, TELEGRAM_CHAT_ID: "424242" });
		const text = await res.text();

		expect(res.status).toBe(502);
		expect(text).toContain("telegram_failed");
		expect(text).not.toContain(TOKEN);
	});

	it("answers 405 to anything but POST and 401 without a session", async () => {
		const wrongMethod = await send({}, "GET");
		const noSession = await app.fetch(
			apiRequest("/api/telegram/test", { method: "POST" }),
			testEnv(),
		);

		expect(wrongMethod.status).toBe(405);
		expect(wrongMethod.headers.get("Allow")).toBe("POST");
		expect(noSession.status).toBe(401);
	});
});
