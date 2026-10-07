import { createApp } from "./app";

const { app } = createApp();

export default {
	// `scheduled` arrives with add-reminders: without jobs there is nothing for a
	// cron to do, and one would waste a Cron Trigger of the free plan.
	fetch: app.fetch,
};
