/// <reference types="vite/client" />
import { env } from "cloudflare:test";
import { beforeAll } from "vitest";

/**
 * Gives the test database the same schema the deployed one has.
 *
 * Until the first table arrived there was nothing to set up, so the pool's D1
 * started empty and `GET /api/health` never noticed. `add-tasks` is the first
 * change whose tests read and write, and it needs the real `migrations/`
 * applied rather than a hand-written `CREATE TABLE`: a test that created its own
 * tables would stop testing the schema that actually ships.
 *
 * The SQL is inlined at build time with `import.meta.glob` because this file
 * runs **inside** the Worker, where `node:fs` does not exist. The alternative,
 * `readD1Migrations` from `@cloudflare/vitest-plugin`, has to pull Miniflare
 * into that same bundle, which then fails to load.
 */

/** Wraps the SQL so a new migration is picked up without touching this file. */
const migrationFiles = import.meta.glob<string>("./migrations/*.sql", {
	query: "?raw",
	import: "default",
	eager: true,
});

/** drizzle-kit writes this between statements so a file is not one huge exec. */
const STATEMENT_BREAKPOINT = "--> statement-breakpoint";

function statementsOf(sql: string): string[] {
	return sql
		.split(STATEMENT_BREAKPOINT)
		.map((statement) => statement.trim())
		.filter((statement) => statement !== "");
}

beforeAll(async () => {
	const files = Object.keys(migrationFiles);
	if (files.length === 0) {
		throw new Error("No hay migraciones en migrations/: los tests no podrían leer D1.");
	}

	for (const file of files) {
		for (const statement of statementsOf(migrationFiles[file] ?? "")) {
			// `prepare().run()` and not `exec()`: `exec` treats every line as the
			// end of a statement, and a `CREATE TABLE` spans several.
			await env.DB.prepare(statement).run();
		}
	}
});
