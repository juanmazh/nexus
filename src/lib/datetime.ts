/**
 * The timezone in which a person reads dates in Nexus. The Worker gets the same
 * value from `APP_TIMEZONE` in `wrangler.jsonc`; the SPA cannot read Worker
 * variables, so the constant lives here once and every component imports it
 * (design.md D8).
 */
export const APP_TIMEZONE = "Europe/Madrid";
