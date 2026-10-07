import { useCallback, useSyncExternalStore } from "react";

/**
 * Subscribes to a media query without a manual listener, so a resize never
 * re-renders outside React's phase (design.md D3).
 *
 * Own hook rather than `unstable_use_media_query` from `@base-ui/react`: the
 * `unstable` prefix in production code is a dependency on an API that can change
 * without notice, and this is about ten lines.
 *
 * Environments without `matchMedia` (older jsdom, server rendering) report
 * `false` instead of throwing, so a missing API degrades to the mobile layout,
 * which is the base design anyway.
 */
export function useMediaQuery(query: string): boolean {
	const subscribe = useCallback(
		(onChange: () => void) => {
			const media = window.matchMedia?.(query);
			if (!media) {
				return () => {};
			}
			media.addEventListener("change", onChange);
			return () => media.removeEventListener("change", onChange);
		},
		[query],
	);

	const getSnapshot = useCallback(() => {
		return window.matchMedia?.(query).matches ?? false;
	}, [query]);

	return useSyncExternalStore(subscribe, getSnapshot, () => false);
}

/** The one breakpoint the shell cares about: navigation changes shape at 1024 px. */
export const DESKTOP_QUERY = "(min-width: 1024px)";

export function useIsDesktop(): boolean {
	return useMediaQuery(DESKTOP_QUERY);
}
