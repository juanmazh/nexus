import { MonitorIcon, MoonIcon, SunIcon } from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import type { ThemePreference } from "@/lib/theme";
import { cn } from "@/lib/utils";

const OPTIONS: { value: ThemePreference; label: string; icon: typeof MonitorIcon }[] = [
	{ value: "system", label: "Sistema", icon: MonitorIcon },
	{ value: "light", label: "Claro", icon: SunIcon },
	{ value: "dark", label: "Oscuro", icon: MoonIcon },
];

/**
 * Three options, not a toggle between two: "follow the system" is the default
 * (docs/DESIGN.md §5) and hiding it would make the choice irreversible without
 * clearing storage.
 *
 * Each option is a 44 × 44 px target and carries a text label for assistive
 * technology, so the choice does not depend on recognising an icon.
 */
export function ThemeToggle({ className }: { className?: string }) {
	const { preference, setPreference } = useTheme();

	return (
		<fieldset
			aria-label="Tema"
			className={cn(
				"inline-flex items-center gap-0.5 rounded-lg border border-border bg-muted/60 p-0.5",
				className,
			)}
		>
			{OPTIONS.map(({ value, label, icon: Icon }) => (
				<button
					key={value}
					type="button"
					aria-pressed={preference === value}
					onClick={() => setPreference(value)}
					className={cn(
						"inline-flex size-11 items-center justify-center rounded-md text-muted-foreground transition-colors focus-visible:ring-3 focus-visible:ring-ring/50",
						preference === value && "bg-background text-foreground shadow-sm ring-1 ring-border",
					)}
				>
					<Icon aria-hidden="true" className="size-5" />
					<span className="sr-only">{label}</span>
				</button>
			))}
		</fieldset>
	);
}
