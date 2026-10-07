import { CheckIcon } from "lucide-react";
import { APP_TIMEZONE } from "@/lib/datetime";
import { cn } from "@/lib/utils";
import type { Task } from "./api";
import { formatShortDate } from "./format";
import { isUnsaved } from "./use-tasks";

/**
 * One task in the list: a full-width button that opens the detail and, apart
 * from it, the 44 × 44 px check. They are two sibling buttons on purpose: a
 * button inside a button is invalid HTML, and on a phone the tap target of the
 * inner one becomes unpredictable (design.md D14).
 *
 * Rows are separated by a thin line, never cards (docs/DESIGN.md §5). Priority
 * "Alta" is written, not coloured, so it does not depend on colour alone.
 */
export function TaskRow({
	task,
	onOpen,
	onToggle,
}: {
	task: Task;
	onOpen: (task: Task) => void;
	onToggle: (task: Task) => void;
}) {
	const done = task.status === "done";
	const date = done ? task.completed_at : task.due_at;
	// Shown at once, acted on only once the API has given it its real id.
	const saving = isUnsaved(task);

	return (
		<li
			aria-busy={saving}
			className="flex items-center gap-2 border-b border-border last:border-b-0"
		>
			<button
				type="button"
				disabled={saving}
				onClick={() => onOpen(task)}
				className="flex min-h-14 min-w-0 flex-1 flex-col items-start justify-center gap-0.5 px-4 py-2 text-left active:bg-muted"
			>
				<span
					className={cn(
						"w-full truncate text-base text-foreground",
						done && "text-muted-foreground line-through",
					)}
				>
					{task.title}
				</span>
				{saving ? <span className="text-sm text-muted-foreground">Guardando…</span> : null}
				{!saving && (date !== null || task.priority === "high") ? (
					<span className="flex items-center gap-2 text-sm text-muted-foreground">
						{date !== null ? (
							<span className="tabular-nums">
								{done ? "Hecha el " : ""}
								{formatShortDate(date, APP_TIMEZONE)}
							</span>
						) : null}
						{task.priority === "high" && !done ? (
							<span className="font-medium text-foreground">Alta</span>
						) : null}
					</span>
				) : null}
			</button>
			<button
				type="button"
				disabled={saving}
				onClick={() => onToggle(task)}
				aria-label={done ? `Deshacer ${task.title}` : `Completar ${task.title}`}
				aria-pressed={done}
				className="mr-2 inline-flex size-11 shrink-0 items-center justify-center rounded-full active:scale-95 disabled:opacity-50"
			>
				<span
					aria-hidden="true"
					className={cn(
						"inline-flex size-6 items-center justify-center rounded-full border-2",
						done ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground",
					)}
				>
					{done ? <CheckIcon className="size-4" strokeWidth={3} /> : null}
				</span>
			</button>
		</li>
	);
}
