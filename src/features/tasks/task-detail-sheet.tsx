import { epochMsToDueDate } from "@shared/dates";
import { updateTaskSchema } from "@shared/tasks";
import { useState } from "react";
import { ResponsiveDialog } from "@/components/responsive-dialog";
import { RemindersSection } from "@/features/reminders/reminders-section";
import { APP_TIMEZONE } from "@/lib/datetime";
import type { Task, UpdateTaskBody } from "./api";
import { useDeleteTask, useUpdateTask } from "./use-tasks";

type Field = "title" | "notes" | "priority" | "due_date";
type Errors = Partial<Record<Field, string>>;

const PRIORITY_LABELS = { low: "Baja", medium: "Normal", high: "Alta" } as const;

const fieldClass =
	"min-h-11 w-full rounded-lg border border-input bg-background px-3 text-base text-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive";
const buttonClass =
	"inline-flex min-h-11 items-center justify-center rounded-lg px-4 text-base font-medium active:scale-[0.98]";

/**
 * The detail of a task, as a bottom sheet on mobile and a dialog on desktop,
 * always through `ResponsiveDialog` (docs/DESIGN.md §4).
 *
 * The form validates with **the same** `updateTaskSchema` the Worker uses, so it
 * shows exactly the message the API would have answered, next to its field and
 * never in a toast. Only the fields that changed are sent: an unchanged form
 * closes without a request.
 */
export function TaskDetailSheet({ task, onClose }: { task: Task | null; onClose: () => void }) {
	return (
		<ResponsiveDialog
			open={task !== null}
			onOpenChange={(open) => {
				if (!open) {
					onClose();
				}
			}}
			title="Detalle de la tarea"
		>
			{/* Keyed by id: opening another task starts from its own values. */}
			{task ? <TaskForm key={task.id} task={task} onClose={onClose} /> : null}
		</ResponsiveDialog>
	);
}

function TaskForm({ task, onClose }: { task: Task; onClose: () => void }) {
	const initial = {
		title: task.title,
		notes: task.notes ?? "",
		priority: task.priority,
		due_date: epochMsToDueDate(task.due_at, APP_TIMEZONE) ?? "",
	};
	const [values, setValues] = useState(initial);
	const [errors, setErrors] = useState<Errors>({});
	const [confirmingDelete, setConfirmingDelete] = useState(false);
	const update = useUpdateTask();
	const remove = useDeleteTask();

	function changes(): UpdateTaskBody {
		const body: UpdateTaskBody = {};
		if (values.title !== initial.title) {
			body.title = values.title;
		}
		if (values.notes !== initial.notes) {
			body.notes = values.notes === "" ? null : values.notes;
		}
		if (values.priority !== initial.priority) {
			body.priority = values.priority;
		}
		if (values.due_date !== initial.due_date) {
			body.due_date = values.due_date === "" ? null : values.due_date;
		}
		return body;
	}

	function save() {
		const body = changes();
		const parsed = updateTaskSchema.safeParse(body);
		if (!parsed.success) {
			const next: Errors = {};
			for (const issue of parsed.error.issues) {
				const field = issue.path[0] as Field | undefined;
				if (field && !next[field]) {
					next[field] = issue.message;
				}
			}
			setErrors(next);
			return;
		}
		setErrors({});
		if (Object.keys(body).length === 0) {
			onClose();
			return;
		}
		update.mutate(
			{ id: task.id, body },
			{
				onSuccess: onClose,
				onError: (error) => setErrors({ title: error.message }),
			},
		);
	}

	const set = (field: Field) => (value: string) =>
		setValues((current) => ({ ...current, [field]: value }));

	if (confirmingDelete) {
		return (
			<div className="flex flex-col gap-4 pb-4">
				<p className="text-base text-foreground">¿Borrar «{task.title}»? No se puede deshacer.</p>
				<div className="flex flex-col gap-2 sm:flex-row-reverse">
					<button
						type="button"
						// Outlined, not filled: there is no token for text on the destructive
						// colour, and white on the dark-mode red does not reach AA.
						className={`${buttonClass} border-2 border-destructive text-destructive`}
						onClick={() => {
							remove.mutate(task);
							onClose();
						}}
					>
						Borrar tarea
					</button>
					<button
						type="button"
						className={`${buttonClass} border border-border text-foreground`}
						onClick={() => setConfirmingDelete(false)}
					>
						Cancelar
					</button>
				</div>
			</div>
		);
	}

	return (
		<>
			<form
				noValidate
				className="flex flex-col gap-4 pb-4"
				onSubmit={(event) => {
					event.preventDefault();
					save();
				}}
			>
				<TextField
					id="tarea-titulo"
					label="Título"
					value={values.title}
					onChange={set("title")}
					error={errors.title}
				/>
				<div className="flex flex-col gap-1.5">
					<label htmlFor="tarea-notas" className="text-sm font-medium text-foreground">
						Notas
					</label>
					<textarea
						id="tarea-notas"
						rows={3}
						value={values.notes}
						onChange={(event) => set("notes")(event.target.value)}
						className={`${fieldClass} py-2`}
					/>
				</div>
				<div className="grid grid-cols-2 gap-3">
					<div className="flex min-w-0 flex-col gap-1.5">
						<label htmlFor="tarea-prioridad" className="text-sm font-medium text-foreground">
							Prioridad
						</label>
						<select
							id="tarea-prioridad"
							value={values.priority}
							onChange={(event) => set("priority")(event.target.value)}
							className={fieldClass}
						>
							{Object.entries(PRIORITY_LABELS).map(([value, label]) => (
								<option key={value} value={value}>
									{label}
								</option>
							))}
						</select>
					</div>
					<TextField
						id="tarea-fecha"
						label="Vence"
						type="date"
						value={values.due_date}
						onChange={set("due_date")}
						error={errors.due_date}
					/>
				</div>
				<div className="flex flex-col gap-2 pt-2 sm:flex-row-reverse sm:justify-between">
					<button
						type="submit"
						disabled={update.isPending}
						className={`${buttonClass} bg-primary text-primary-foreground disabled:opacity-60`}
					>
						Guardar tarea
					</button>
					<button
						type="button"
						className={`${buttonClass} text-destructive`}
						onClick={() => setConfirmingDelete(true)}
					>
						Borrar
					</button>
				</div>
			</form>
			<RemindersSection task={task} />
		</>
	);
}

function TextField({
	id,
	label,
	value,
	onChange,
	error,
	type = "text",
}: {
	id: string;
	label: string;
	value: string;
	onChange: (value: string) => void;
	error?: string;
	type?: "text" | "date";
}) {
	const errorId = `${id}-error`;
	return (
		<div className="flex min-w-0 flex-col gap-1.5">
			<label htmlFor={id} className="text-sm font-medium text-foreground">
				{label}
			</label>
			<input
				id={id}
				type={type}
				value={value}
				onChange={(event) => onChange(event.target.value)}
				aria-invalid={error ? true : undefined}
				aria-describedby={error ? errorId : undefined}
				enterKeyHint={type === "text" ? "done" : undefined}
				className={`${fieldClass} tabular-nums`}
			/>
			{error ? (
				<p id={errorId} className="text-sm text-destructive">
					{error}
				</p>
			) : null}
		</div>
	);
}
