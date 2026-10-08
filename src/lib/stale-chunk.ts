/**
 * Recovery after a deploy (reload-on-stale-chunk design.md D1).
 *
 * The sections are `lazy()` and each one lives in a file named after the hash
 * of its content. A deploy replaces those files, and an installed app that
 * stayed alive in the background still asks for the old ones: the Worker
 * answers with `index.html` and the section does not load. Vite reports that
 * failure as `vite:preloadError`, and reloading brings the new version.
 */

export const STALE_CHUNK_STORAGE_KEY = "nexus:stale-chunk-reload";

/** Long enough to cover a reload on a phone, short enough for the next deploy. */
export const RELOAD_WINDOW_MS = 10_000;

export type StaleChunkEnvironment = {
	/** A getter, because reading `sessionStorage` itself can throw. */
	storage: () => Pick<Storage, "getItem" | "setItem">;
	online: () => boolean;
	now: () => number;
	reload: () => void;
};

/**
 * Reloads once and returns `true`; otherwise leaves the error alone, so it
 * reaches the section's error view, and returns `false`:
 * - offline, a reload would swap the app for the browser's offline page;
 * - after a reload less than 10 s ago, the new version fails too and another
 *   one would be a loop;
 * - without storage there is no way to know the above, so no reload either.
 */
export function handleStaleChunk(event: Event, env: StaleChunkEnvironment): boolean {
	if (!env.online()) {
		return false;
	}

	const now = env.now();
	try {
		const storage = env.storage();
		const last = Number(storage.getItem(STALE_CHUNK_STORAGE_KEY));
		if (last > 0 && Math.abs(now - last) < RELOAD_WINDOW_MS) {
			return false;
		}
		storage.setItem(STALE_CHUNK_STORAGE_KEY, String(now));
	} catch {
		return false;
	}

	event.preventDefault();
	env.reload();
	return true;
}

/** Registers the handler on `win`; returns the function that removes it. */
export function installStaleChunkReload(win: Window = window): () => void {
	const listener = (event: Event) => {
		handleStaleChunk(event, {
			storage: () => win.sessionStorage,
			online: () => win.navigator.onLine,
			now: () => Date.now(),
			reload: () => win.location.reload(),
		});
	};
	win.addEventListener("vite:preloadError", listener);
	return () => win.removeEventListener("vite:preloadError", listener);
}
