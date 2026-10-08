import { Hono } from "hono";
import {
	sendTelegramMessage,
	TEST_MESSAGE,
	type TelegramBindings,
	telegramConfig,
} from "../integrations/telegram";
import type { AccessEnv } from "../middleware/access";
import { errorBody } from "../middleware/errors";
import { onlyMethods } from "../middleware/validation";

type TelegramEnv = {
	Bindings: AccessEnv["Bindings"] & TelegramBindings;
	Variables: AccessEnv["Variables"];
};

/**
 * `POST /api/telegram/test`: a message sent right now, so the secrets can be
 * checked the day of the deploy instead of waiting for a real reminder
 * (add-reminders design.md D12). It writes nothing.
 */
export const telegram = new Hono<TelegramEnv>()
	.use("/test", onlyMethods(["POST"]))
	.post("/test", async (c) => {
		const config = telegramConfig(c.env);
		if (!config.ok) {
			return c.json(
				errorBody(
					"telegram_not_configured",
					`Falta configurar ${config.missing.join(" y ")} en el Worker.`,
				),
				503,
			);
		}

		const result = await sendTelegramMessage(config.config, TEST_MESSAGE);
		if (!result.ok) {
			return c.json(errorBody("telegram_failed", result.error), 502);
		}
		return c.body(null, 204);
	});
