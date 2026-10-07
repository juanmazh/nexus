import { fileURLToPath } from "node:url";
import { cloudflareTest } from "@cloudflare/vitest-plugin";
import { defineProject } from "vitest/config";

export default defineProject({
	// Reading wrangler.jsonc gives the tests the same `main`,
	// compatibility_date and bindings the Worker runs with, so `env.DB` is
	// present even though /api/health does not read it.
	plugins: [cloudflareTest({ wrangler: { configPath: "./wrangler.jsonc" } })],
	// The Worker imports the schemas and the date arithmetic from `shared/`, and
	// this project has no Vite config to inherit the alias from, so the same one
	// as `vite.config.ts` and `vitest.web.config.ts` is declared here.
	resolve: {
		alias: [
			{
				find: /^@shared\//,
				replacement: `${fileURLToPath(new URL("./shared", import.meta.url))}/`,
			},
		],
	},
	test: {
		name: "worker",
		include: ["worker/**/*.test.ts"],
		// Applies `migrations/` to the pool's D1, so the tests run against the
		// schema that actually ships.
		setupFiles: ["./vitest.setup.worker.ts"],
	},
});
