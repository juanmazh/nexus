import { cloudflareTest } from "@cloudflare/vitest-plugin";
import { defineProject } from "vitest/config";

export default defineProject({
	// Reading wrangler.jsonc gives the tests the same `main`,
	// compatibility_date and bindings the Worker runs with, so `env.DB` is
	// present even though /api/health does not read it.
	plugins: [cloudflareTest({ wrangler: { configPath: "./wrangler.jsonc" } })],
	test: {
		name: "worker",
		include: ["worker/**/*.test.ts"],
	},
});
