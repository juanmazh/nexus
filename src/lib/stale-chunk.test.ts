import { describe, expect, it, vi } from "vitest";
import {
	handleStaleChunk,
	installStaleChunkReload,
	RELOAD_WINDOW_MS,
	STALE_CHUNK_STORAGE_KEY,
	type StaleChunkEnvironment,
} from "./stale-chunk";

const NOW = Date.UTC(2026, 9, 8, 21, 0);

function environment(overrides: Partial<StaleChunkEnvironment> = {}) {
	const values = new Map<string, string>();
	const storage = {
		getItem: (key: string) => values.get(key) ?? null,
		setItem: (key: string, value: string) => void values.set(key, value),
	};
	const env = {
		storage: () => storage,
		online: () => true,
		now: () => NOW,
		reload: vi.fn(),
		...overrides,
	};
	return { env, values };
}

const preloadError = () => new Event("vite:preloadError", { cancelable: true });

describe("handleStaleChunk", () => {
	it("reloads once, cancels the error and remembers when", () => {
		const { env, values } = environment();
		const event = preloadError();

		expect(handleStaleChunk(event, env)).toBe(true);

		expect(env.reload).toHaveBeenCalledTimes(1);
		expect(event.defaultPrevented).toBe(true);
		expect(values.get(STALE_CHUNK_STORAGE_KEY)).toBe(String(NOW));
	});

	it("does not reload again within 10 s, and lets the error through", () => {
		const { env, values } = environment();
		values.set(STALE_CHUNK_STORAGE_KEY, String(NOW - RELOAD_WINDOW_MS + 1));
		const event = preloadError();

		expect(handleStaleChunk(event, env)).toBe(false);

		expect(env.reload).not.toHaveBeenCalled();
		expect(event.defaultPrevented).toBe(false);
	});

	it("reloads again for a later deploy", () => {
		const { env, values } = environment();
		values.set(STALE_CHUNK_STORAGE_KEY, String(NOW - 3 * 3_600_000));

		expect(handleStaleChunk(preloadError(), env)).toBe(true);
	});

	it("does not reload offline", () => {
		const { env } = environment({ online: () => false });

		expect(handleStaleChunk(preloadError(), env)).toBe(false);
		expect(env.reload).not.toHaveBeenCalled();
	});

	it("does not reload when the storage cannot be used", () => {
		const { env } = environment({
			storage: () => {
				throw new Error("storage blocked");
			},
		});

		expect(handleStaleChunk(preloadError(), env)).toBe(false);
		expect(env.reload).not.toHaveBeenCalled();
	});
});

describe("installStaleChunkReload", () => {
	it("listens to vite:preloadError on the window until it is removed", () => {
		const target = new EventTarget();
		const win = Object.assign(target, {
			sessionStorage: { getItem: () => null, setItem: () => {} },
			navigator: { onLine: true },
			location: { reload: vi.fn() },
		}) as unknown as Window;

		const remove = installStaleChunkReload(win);
		win.dispatchEvent(preloadError());
		remove();
		win.dispatchEvent(preloadError());

		expect(win.location.reload).toHaveBeenCalledTimes(1);
	});
});
