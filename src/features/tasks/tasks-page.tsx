import { useState } from "react";
import { ViewHeader } from "@/app/layout/view-header";
import { EmptyState } from "@/components/empty-state";
import { SkeletonList } from "@/components/skeleton";
import { APP_TIMEZONE } from "@/lib/datetime";
import type { Task } from "./api";
import { pendingCountLabel } from "./format";
import { groupTasks } from "./group";
import { useTaskDetail } from "./task-detail-context";
import { TaskRow } from "./task-row";
import { useSetTaskStatus, useTasks } from "./use-tasks";

const SECTIONS = [
	["overdue", "Vencidas"],
	["today", "Hoy"],
	["upcoming", "Próximas"],
	["noDate", "Sin fecha"],
] as const;

/**
 * The list of tasks: Vencidas / Hoy / Próximas / Sin fecha, then the completed
 * ones behind "Hechas (N)". The order inside each section is the API's; this
 * view only groups (design.md D12).
 */
export function TasksPage() {
	const pending = useTasks("todo");
	const completed = useTasks("done");
	const setStatus = useSetTaskStatus();
	const [showDone, setShowDone] = useState(false);
	const { openTask } = useTaskDetail();

	const toggle = (task: Task) =>
		setStatus.mutate({ task, status: task.status === "done" ? "todo" : "done" });

	const doneTasks = completed.data ?? [];
	const sections = pending.data ? groupTasks(pending.data, Date.now(), APP_TIMEZONE) : null;
	const subtitle = pending.data
		? pendingCountLabel(pending.data.length)
		: "Lo que tienes que hacer";

	return (
		<>
			<ViewHeader title="Tareas" subtitle={subtitle} />

			{pending.isPending ? (
				<div role="status" aria-live="polite">
					<span className="sr-only">Cargando las tareas…</span>
					<SkeletonList rows={4} />
				</div>
			) : null}

			{pending.isError ? (
				<div role="alert" className="flex flex-col items-start gap-3 px-4 py-6">
					<p className="font-medium text-destructive">No se han podido cargar las tareas.</p>
					<button
						type="button"
						onClick={() => void pending.refetch()}
						className="inline-flex min-h-11 items-center rounded-lg border border-border px-4 text-base font-medium text-foreground"
					>
						Reintentar
					</button>
				</div>
			) : null}

			{pending.data && pending.data.length === 0 && doneTasks.length === 0 ? (
				<EmptyState
					title="Sin tareas"
					description="Nada pendiente. Añade la primera con la barra de captura."
				/>
			) : null}

			{sections
				? SECTIONS.map(([key, label]) => {
						const list = sections[key];
						return list.length > 0 ? (
							<section key={key} aria-labelledby={`seccion-${key}`} className="pt-4">
								<h2
									id={`seccion-${key}`}
									className="px-4 pb-1 text-xs font-medium tracking-wide text-muted-foreground"
								>
									{label}
								</h2>
								<ul>
									{list.map((task) => (
										<TaskRow key={task.id} task={task} onOpen={openTask} onToggle={toggle} />
									))}
								</ul>
							</section>
						) : null;
					})
				: null}

			{doneTasks.length > 0 ? (
				<section aria-label="Tareas hechas" className="mt-4 border-t border-border">
					<button
						type="button"
						aria-pressed={showDone}
						onClick={() => setShowDone((current) => !current)}
						className="flex min-h-11 w-full items-center px-4 text-left text-sm font-medium text-muted-foreground active:bg-muted"
					>
						Hechas ({doneTasks.length})
					</button>
					{showDone ? (
						<ul>
							{doneTasks.map((task) => (
								<TaskRow key={task.id} task={task} onOpen={openTask} onToggle={toggle} />
							))}
						</ul>
					) : null}
				</section>
			) : null}
		</>
	);
}
