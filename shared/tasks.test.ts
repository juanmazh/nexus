import { describe, expect, it } from "vitest";
import {
	createTaskSchema,
	listTasksQuerySchema,
	taskIdParamSchema,
	updateTaskSchema,
} from "./tasks";

/**
 * The schemas are the contract of the whole feature: the Worker answers `400`
 * with their messages and the detail form shows them. What is tested here is
 * therefore not Zod but the decisions — a blank title, an unknown property, a
 * closed set of values and the difference between "absent" and "explicitly
 * empty", which is the one that decides whether an edit keeps or loses the
 * notes.
 */

const VALID_UUID = "6f5b1d2c-3a4e-4b6f-8c9d-0e1f2a3b4c5d";

describe("createTaskSchema", () => {
	it("accepts nothing but a title", () => {
		const parsed = createTaskSchema.parse({ title: "  Llamar al dentista  " });

		expect(parsed.title).toBe("Llamar al dentista");
	});

	it("rejects a blank title and says so in Spanish", () => {
		const result = createTaskSchema.safeParse({ title: "   " });

		expect(result.success).toBe(false);
		expect(result.error?.issues[0]?.message).toBe("Escribe un título para la tarea.");
	});

	it("rejects a title of 201 characters and accepts exactly 200", () => {
		expect(createTaskSchema.safeParse({ title: "a".repeat(201) }).success).toBe(false);
		expect(createTaskSchema.safeParse({ title: "a".repeat(200) }).success).toBe(true);
	});

	it("rejects a property it does not know instead of dropping it", () => {
		const result = createTaskSchema.safeParse({ title: "Algo", completed_at: 1 });

		expect(result.success).toBe(false);
	});

	it("never accepts a state: the initial one is `todo` by definition", () => {
		expect(createTaskSchema.safeParse({ title: "Algo", status: "done" }).success).toBe(false);
	});

	it("names the field whose value is not one of the allowed ones", () => {
		const priority = createTaskSchema.safeParse({ title: "Algo", priority: "urgent" });
		const status = listTasksQuerySchema.safeParse({ status: "pendiente" });

		expect(priority.error?.issues[0]?.message).toBe(
			"La prioridad solo puede ser low, medium o high.",
		);
		expect(status.error?.issues[0]?.message).toBe("El estado solo puede ser todo o done.");
	});

	it("takes the due date as a plain calendar date", () => {
		expect(createTaskSchema.parse({ title: "Algo", due_date: "2026-10-10" }).due_date).toBe(
			"2026-10-10",
		);
		expect(createTaskSchema.safeParse({ title: "Algo", due_date: "10/10/2026" }).success).toBe(
			false,
		);
	});

	it("rejects a date that does not exist instead of rolling it over", () => {
		const result = createTaskSchema.safeParse({ title: "Algo", due_date: "2026-02-31" });

		expect(result.success).toBe(false);
		expect(result.error?.issues[0]?.message).toBe("Esa fecha no existe en el calendario.");
		expect(createTaskSchema.safeParse({ title: "Algo", due_date: "2028-02-29" }).success).toBe(
			true,
		);
	});

	it("lets notes and due date be explicitly empty", () => {
		const parsed = createTaskSchema.parse({ title: "Algo", notes: null, due_date: null });

		expect(parsed.notes).toBeNull();
		expect(parsed.due_date).toBeNull();
	});

	it("gives a new task the documented defaults", () => {
		const parsed = createTaskSchema.parse({ title: "Algo" });

		expect(parsed.priority ?? "medium").toBe("medium");
	});
});

describe("updateTaskSchema", () => {
	it("leaves an absent optional field absent, not empty", () => {
		const parsed = updateTaskSchema.parse({ title: "Otro título" });

		// The difference is what keeps the notes when only the title is edited.
		expect("notes" in parsed).toBe(false);
		expect("due_date" in parsed).toBe(false);
	});

	it("clears a field only when it is sent explicitly", () => {
		const parsed = updateTaskSchema.parse({ notes: null, due_date: null });

		expect(parsed.notes).toBeNull();
		expect(parsed.due_date).toBeNull();
	});

	it("rejects a blank title here too", () => {
		expect(updateTaskSchema.safeParse({ title: "" }).success).toBe(false);
	});

	it("rejects an unknown property", () => {
		expect(updateTaskSchema.safeParse({ title: "Algo", id: VALID_UUID }).success).toBe(false);
	});

	it("accepts an empty body, which means nothing to change", () => {
		expect(updateTaskSchema.safeParse({}).success).toBe(true);
	});
});

describe("listTasksQuerySchema", () => {
	it("defaults to nothing, which the route reads as the pending list", () => {
		expect(listTasksQuerySchema.parse({})).toEqual({});
	});

	it("reads the two closed values of `status`", () => {
		expect(listTasksQuerySchema.parse({ status: "todo" }).status).toBe("todo");
		expect(listTasksQuerySchema.parse({ status: "done" }).status).toBe("done");
		expect(listTasksQuerySchema.safeParse({ status: "todas" }).success).toBe(false);
	});

	it("turns `overdue` into a real boolean instead of coercing anything", () => {
		expect(listTasksQuerySchema.parse({ overdue: "true" }).overdue).toBe(true);
		expect(listTasksQuerySchema.parse({ overdue: "false" }).overdue).toBe(false);
		expect(listTasksQuerySchema.safeParse({ overdue: "1" }).success).toBe(false);
		// The bug a boolean coercion would cause: "no" would mean "yes".
		expect(listTasksQuerySchema.safeParse({ overdue: "no" }).success).toBe(false);
	});

	it("rejects a filter it does not know", () => {
		expect(listTasksQuerySchema.safeParse({ priority: "high" }).success).toBe(false);
	});
});

describe("taskIdParamSchema", () => {
	it("accepts a uuid, which is what `crypto.randomUUID()` writes", () => {
		expect(taskIdParamSchema.parse({ id: VALID_UUID }).id).toBe(VALID_UUID);
	});

	it("rejects anything else, so a wrong id is a 404 and not a query", () => {
		expect(taskIdParamSchema.safeParse({ id: "1" }).success).toBe(false);
		expect(taskIdParamSchema.safeParse({}).success).toBe(false);
	});
});
