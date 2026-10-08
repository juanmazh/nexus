import { DEFAULT_QUIET_HOURS, type QuietHours } from "@shared/recurrence";
import { eq } from "drizzle-orm";
import type { NexusDb } from "../db/client";
import { settings } from "../db/schema";

/**
 * The quiet hours of recurring reminders, stored in the single settings row
 * (add-recurring-reminders design.md D3). A missing row means the default; a
 * row with both columns null means "turned off".
 */

export const SETTINGS_ID = 1;

export function quietHoursFromRow(
	row: { quiet_start: string | null; quiet_end: string | null } | undefined,
): QuietHours {
	if (!row) {
		return DEFAULT_QUIET_HOURS;
	}
	return row.quiet_start && row.quiet_end ? { start: row.quiet_start, end: row.quiet_end } : null;
}

export async function getQuietHours(db: NexusDb): Promise<QuietHours> {
	const [row] = await db.select().from(settings).where(eq(settings.id, SETTINGS_ID)).limit(1);
	return quietHoursFromRow(row);
}

export async function setQuietHours(
	db: NexusDb,
	quiet: QuietHours,
	now: number = Date.now(),
): Promise<QuietHours> {
	const values = {
		quiet_start: quiet?.start ?? null,
		quiet_end: quiet?.end ?? null,
		updated_at: now,
	};
	await db
		.insert(settings)
		.values({ id: SETTINGS_ID, ...values })
		.onConflictDoUpdate({ target: settings.id, set: values });
	return quiet;
}
