import { describe, expect, it } from "vitest";
import { createReminderSchema, reminderIdParamSchema } from "./reminders";

describe("createReminderSchema", () => {
	it("accepts the value of a native datetime-local input", () => {
		expect(createReminderSchema.parse({ remind_at: "2026-10-07T18:00" })).toEqual({
			remind_at: "2026-10-07T18:00",
		});
	});

	it("rejects a missing time, another format and an unknown property", () => {
		expect(createReminderSchema.safeParse({}).error?.issues[0]?.message).toBe(
			"Indica la fecha y la hora del aviso.",
		);
		expect(
			createReminderSchema.safeParse({ remind_at: "2026-10-07T18:00:00Z" }).error?.issues[0]
				?.message,
		).toBe("La hora del aviso tiene que tener el formato AAAA-MM-DDTHH:mm.");
		expect(
			createReminderSchema.safeParse({ remind_at: "2026-10-07T18:00", channel: "email" }).success,
		).toBe(false);
	});
});

describe("reminderIdParamSchema", () => {
	it("accepts only a uuid", () => {
		expect(reminderIdParamSchema.safeParse({ id: crypto.randomUUID() }).success).toBe(true);
		expect(reminderIdParamSchema.safeParse({ id: "1" }).success).toBe(false);
	});
});
