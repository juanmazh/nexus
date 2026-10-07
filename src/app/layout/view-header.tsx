import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * The bar at the top of every section: the title of the view and room for one
 * action (docs/DESIGN.md §3). The title is an `h1`, so the document has exactly
 * one heading per section and assistive technology can jump to it.
 *
 * On mobile the header is where the view title goes and nothing else; from
 * 1024 px up the capture bar joins it in the same row.
 */
export function ViewHeader({
	title,
	subtitle,
	action,
	className,
}: {
	title: string;
	subtitle?: ReactNode;
	/** The one action the header can hold, e.g. the theme switcher. */
	action?: ReactNode;
	className?: string;
}) {
	return (
		<header
			data-slot="view-header"
			// Safe area first: on a notched phone the title would otherwise sit under
			// the notch.
			className={cn(
				"shrink-0 border-b border-border bg-background",
				"pt-[env(safe-area-inset-top)]",
				className,
			)}
		>
			<div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2 px-4 py-3 lg:items-center">
				<div className="min-w-0 flex-1">
					<h1 className="font-heading text-2xl leading-tight font-semibold tracking-tight text-foreground lg:text-[2.125rem]">
						{title}
					</h1>
					{subtitle ? (
						<p className="mt-0.5 text-sm leading-5 text-muted-foreground">{subtitle}</p>
					) : null}
				</div>
				{action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
			</div>
		</header>
	);
}
