import type { ReactNode } from "react";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ResolvedTheme, ThemePreference } from "@/lib/theme";
import {
	applyTheme,
	DARK_SCHEME_QUERY,
	readStoredPreference,
	systemPrefersDark,
} from "@/lib/theme";

type ThemeContextValue = {
	/** What the person chose; `system` while there is no manual choice. */
	preference: ThemePreference;
	/** What is actually painted right now. */
	resolved: ResolvedTheme;
	setPreference: (preference: ThemePreference) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

/**
 * Owns the theme after the first paint. `main.tsx` calls `applyTheme(document)`
 * before rendering so there is no flash; this provider keeps the choice, follows
 * the system while nobody has chosen, and repaints on change (design.md D5).
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
	const [preference, setPreference] = useState<ThemePreference>(
		() => readStoredPreference(document) ?? "system",
	);
	const [prefersDark, setPrefersDark] = useState(() => systemPrefersDark(document));
	const [resolved, setResolved] = useState<ResolvedTheme>(() => applyTheme(document));

	useEffect(() => {
		setResolved(applyTheme(document, preference, prefersDark));
	}, [preference, prefersDark]);

	// The system is only listened to while there is no manual choice: choosing a
	// theme is the whole point of the switcher.
	useEffect(() => {
		if (preference !== "system") {
			return;
		}

		const media = window.matchMedia?.(DARK_SCHEME_QUERY);
		if (!media) {
			return;
		}

		const onChange = (event: MediaQueryListEvent) => setPrefersDark(event.matches);
		media.addEventListener("change", onChange);
		return () => media.removeEventListener("change", onChange);
	}, [preference]);

	const value = useMemo<ThemeContextValue>(
		() => ({ preference, resolved, setPreference }),
		[preference, resolved],
	);

	return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
	const context = useContext(ThemeContext);
	if (!context) {
		throw new Error("useTheme debe usarse dentro de <ThemeProvider>.");
	}
	return context;
}
