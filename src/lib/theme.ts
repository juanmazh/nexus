/**
 * Theme resolution, kept out of the components (design.md D5).
 *
 * The CSP in `public/_headers` has no `'unsafe-inline'` in `script-src`, so the
 * usual inline script that decides the theme before the first paint is not
 * available: the theme is resolved in JavaScript instead, and `main.tsx` calls
 * `applyTheme(document)` before rendering anything.
 */

export const THEME_STORAGE_KEY = "nexus:theme";

export const DARK_SCHEME_QUERY = "(prefers-color-scheme: dark)";

/** What the person chose. `system` means "no manual choice yet". */
export type ThemePreference = "system" | "light" | "dark";

/** What actually gets painted. */
export type ResolvedTheme = "light" | "dark";

export function isThemePreference(value: unknown): value is ThemePreference {
	return value === "system" || value === "light" || value === "dark";
}

/**
 * A manual choice wins over the system preference; `system` (or a missing or
 * unrecognised value) follows it. Pure, so all four combinations are testable
 * without a DOM.
 */
export function resolveTheme(stored: ThemePreference | null, prefersDark: boolean): ResolvedTheme {
	if (stored === "light" || stored === "dark") {
		return stored;
	}
	return prefersDark ? "dark" : "light";
}

/**
 * `localStorage` throws in some private-browsing modes. Losing the remembered
 * choice is survivable; a blank screen is not, so the failure degrades to
 * "follow the system".
 */
export function readStoredPreference(doc: Document): ThemePreference | null {
	try {
		const raw = doc.defaultView?.localStorage.getItem(THEME_STORAGE_KEY) ?? null;
		return isThemePreference(raw) ? raw : null;
	} catch {
		return null;
	}
}

export function storePreference(doc: Document, preference: ThemePreference): void {
	try {
		doc.defaultView?.localStorage.setItem(THEME_STORAGE_KEY, preference);
	} catch {
		// Same reasoning as above: a preference that cannot be saved is not an error.
	}
}

export function systemPrefersDark(doc: Document): boolean {
	try {
		return doc.defaultView?.matchMedia?.(DARK_SCHEME_QUERY).matches ?? false;
	} catch {
		return false;
	}
}

/**
 * Puts `light`/`dark` on `<html>` and returns what was painted.
 *
 * Both inputs are optional so the first call can be the bare
 * `applyTheme(document)` that `main.tsx` makes before the first render, reading
 * the stored choice and the system preference itself. A caller that already
 * knows them (`ThemeProvider`) passes them instead, so the stored choice is not
 * read back from storage on every change.
 */
export function applyTheme(
	doc: Document,
	preference?: ThemePreference,
	prefersDark?: boolean,
): ResolvedTheme {
	if (preference !== undefined) {
		storePreference(doc, preference);
	}

	const resolved = resolveTheme(
		preference ?? readStoredPreference(doc),
		prefersDark ?? systemPrefersDark(doc),
	);

	doc.documentElement.classList.toggle("dark", resolved === "dark");
	doc.documentElement.classList.toggle("light", resolved === "light");

	return resolved;
}
