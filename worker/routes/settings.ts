import { quietHoursSchema } from "@shared/reminders";
import { Hono } from "hono";
import { createDb } from "../db/client";
import { type DataEnv, onlyMethods, validated } from "../middleware/validation";
import * as settingsService from "../services/settings";

/** `GET`/`PUT /api/settings/quiet-hours` (add-recurring-reminders design.md D3). */
export const settingsRoutes = new Hono<DataEnv>()
	.use("/quiet-hours", onlyMethods(["GET", "PUT"]))
	.get("/quiet-hours", async (c) => {
		return c.json(await settingsService.getQuietHours(createDb(c.env)), 200);
	})
	.put("/quiet-hours", validated("json", quietHoursSchema), async (c) => {
		const saved = await settingsService.setQuietHours(createDb(c.env), c.req.valid("json"));
		return c.json(saved, 200);
	});
