import { describe, expect, it } from "vitest";
import { createReminderSchema, quietHoursSchema, reminderIdParamSchema } from "./reminders";

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

describe("createReminderSchema with a repetition", () => {
	const at = "2026-10-08T09:00";

	it("accepts every N hours or days within their bounds", () => {
		for (const repeat of [
			{ every: 1, unit: "hours" },
			{ every: 720, unit: "hours" },
			{ every: 1, unit: "days" },
			{ every: 30, unit: "days" },
		]) {
			expect(
				createReminderSchema.safeParse({ remind_at: at, repeat }).success,
				JSON.stringify(repeat),
			).toBe(true);
		}
	});

	it("rejects zero, fractions, out-of-range values and unknown units with a message", () => {
		const message = (repeat: unknown) =>
			createReminderSchema.safeParse({ remind_at: at, repeat }).error?.issues[0]?.message;

		expect(message({ every: 0, unit: "hours" })).toBe("El intervalo mínimo es 1.");
		expect(message({ every: 1.5, unit: "hours" })).toBe(
			"El intervalo tiene que ser un número entero.",
		);
		expect(message({ every: 721, unit: "hours" })).toBe(
			"Como mucho cada 720 horas o cada 30 días.",
		);
		expect(message({ every: 31, unit: "days" })).toBe("Como mucho cada 720 horas o cada 30 días.");
		expect(message({ every: 2, unit: "weeks" })).toBe("La unidad solo puede ser horas o días.");
	});
});

describe("quietHoursSchema", () => {
	it("accepts a window, one that crosses midnight, and null to turn it off", () => {
		expect(quietHoursSchema.parse({ start: "23:00", end: "08:00" })).toEqual({
			start: "23:00",
			end: "08:00",
		});
		expect(quietHoursSchema.parse({ start: "14:00", end: "16:00" })).toEqual({
			start: "14:00",
			end: "16:00",
		});
		expect(quietHoursSchema.parse(null)).toBeNull();
	});

	it("rejects malformed times and an empty window", () => {
		expect(quietHoursSchema.safeParse({ start: "25:00", end: "08:00" }).success).toBe(false);
		expect(quietHoursSchema.safeParse({ start: "8:00", end: "09:00" }).success).toBe(false);
		expect(
			quietHoursSchema.safeParse({ start: "08:00", end: "08:00" }).error?.issues[0]?.message,
		).toBe("El inicio y el fin no pueden ser la misma hora.");
	});
});
