import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * The state a section shows before it has anything: what will live here and an
 * invitation to put the first thing in it (docs/DESIGN.md §1.3). Every section
 * of the shell has one, so a new section cannot ship without it by accident.
 */
export function EmptyState({
	title,
	description,
	action,
	className,
}: {
	title: string;
	description: string;
	action?: ReactNode;
	className?: string;
}) {
	return (
		<div
			className={cn(
				// `min-w-0` so long words wrap instead of forcing horizontal scroll at
				// 320 px, and text only: no icon needed at this size.
				"flex min-w-0 flex-col items-start gap-2 px-4 py-8 text-left",
				className,
			)}
		>
			<h2 className="font-heading text-lg font-medium text-foreground">{title}</h2>
			<p className="max-w-prose text-base leading-6 text-muted-foreground">{description}</p>
			{action ? <div className="mt-2">{action}</div> : null}
		</div>
	);
}
