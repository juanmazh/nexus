import { cn } from "@/lib/utils";

/**
 * A skeleton with the shape of the content it stands in for, never a spinner
 * over the whole screen (docs/DESIGN.md §4). `aria-hidden` because the loading
 * state is announced by whoever renders it, and a decorative shape announced as
 * content is noise for a screen reader.
 */
export function Skeleton({ className }: { className?: string }) {
	return (
		<div
			aria-hidden="true"
			className={cn("animate-pulse rounded-md bg-muted", className)}
			data-slot="skeleton"
		/>
	);
}

/** A list of rows, which is what most sections will show. */
export function SkeletonList({ rows = 3 }: { rows?: number }) {
	// Keyed by position on purpose: these placeholders have no identity of their
	// own, they only stand for "something of this shape is coming".
	const placeholders = Array.from({ length: rows }, (_, position) => `fila-${position}`);

	return (
		<div className="flex flex-col" data-slot="skeleton-list">
			{placeholders.map((placeholder) => (
				<Skeleton key={placeholder} className="h-14 border-b border-border last:border-b-0" />
			))}
		</div>
	);
}
