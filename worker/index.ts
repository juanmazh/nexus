import { createApp } from "./app";
import { runReminders } from "./jobs/reminders";

const { app } = createApp();

export default {
	fetch: app.fetch,
	/**
	 * The Cron Trigger of `wrangler.jsonc` (every 5 minutes). `waitUntil` keeps
	 * the invocation alive until the job has written its results.
	 */
	scheduled(_controller, env, ctx) {
		ctx.waitUntil(runReminders(env, Date.now()).then(() => undefined));
	},
} satisfies ExportedHandler<Env>;
