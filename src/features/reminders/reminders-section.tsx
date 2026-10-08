import { epochMsToLocalDateTime, zonedDayNumber } from "@shared/dates";
import { formatShortDate, formatTime } from "@shared/format";
import { useEffect, useRef, useState } from "react";
import { Skeleton } from "@/components/skeleton";
import { APP_TIMEZONE } from "@/lib/datetime";
import type { Task } from "../tasks/api";
import type { Reminder } from "./api";
import { reminderShortcuts } from "./shortcuts";
import { useCancelReminder, useCreateReminder, useReminders } from "./use-reminders";

const fieldClass =
	"min-h-11 w-full min-w-0 rounded-lg border border-input bg-background px-3 text-base text-foreground tabular-nums focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive";
const buttonClass =
	"inline-flex min-h-11 items-center justify-center rounded-lg px-4 text-base font-medium active:scale-[0.98] disabled:opacity-60";

/** "hoy a las 18:00" / "el vie 9 oct a las 9:00", for the confirmation. */
function spokenTime(ms: number, now: number): string {
	const time = formatTime(ms, APP_TIMEZONE);
	return zonedDayNumber(ms, APP_TIMEZONE) === zonedDayNumber(now, APP_TIMEZONE)
		? `de hoy a las ${time}`
		: `del ${formatShortDate(ms, APP_TIMEZONE)} a las ${time}`;
}

/** "Hoy, 18:00" / "vie 9 oct, 9:00", for the list. */
function listedTime(ms: number, now: number): string {
	const time = formatTime(ms, APP_TIMEZONE);
	return zonedDayNumber(ms, APP_TIMEZONE) === zonedDayNumber(now, APP_TIMEZONE)
		? `Hoy, ${time}`
		: `${formatShortDate(ms, APP_TIMEZONE)}, ${time}`;
}

/**
 * The reminders of a task, inside its detail and **outside** its form: creating
 * or cancelling a reminder happens at once and does not wait for "Guardar tarea"
 * (add-reminders design.md D11).
 */
export function RemindersSection({ task }: { task: Task }) {
	const done = task.status === "done";

	return (
		<section
			aria-labelledby="avisos-titulo"
			className="flex flex-col gap-3 border-t border-border pt-4 pb-4"
		>
			<h3 id="avisos-titulo" className="font-heading text-base font-medium text-foreground">
				Recordatorios
			</h3>
			{done ? (
				<p className="text-sm text-muted-foreground">
					La tarea está hecha: ya no tiene avisos pendientes.
				</p>
			) : (
				<PendingTaskReminders task={task} />
			)}
		</section>
	);
}

function PendingTaskReminders({ task }: { task: Task }) {
	const now = Date.now();
	const shortcuts = reminderShortcuts(now, task.due_at, APP_TIMEZONE);
	const reminders = useReminders(task.id);
	const create = useCreateReminder(task.id);
	const [custom, setCustom] = useState("");
	const [error, setError] = useState<string | null>(null);

	function add(remindAt: string) {
		setError(null);
		create.mutate(remindAt, {
			onSuccess: () => setCustom(""),
			onError: (failure) => setError(failure.message),
		});
	}

	return (
		<>
			<p className="text-sm text-muted-foreground">
				Llegan por Telegram en los 5 minutos siguientes a la hora.
			</p>

			{shortcuts.length > 0 ? (
				<fieldset className="m-0 min-w-0 border-0 p-0">
					<legend className="sr-only">Atajos de aviso</legend>
					<div className="flex flex-wrap gap-2">
						{shortcuts.map((shortcut) => (
							<button
								key={shortcut.label}
								type="button"
								disabled={create.isPending}
								onClick={() => add(shortcut.value)}
								className={`${buttonClass} rounded-full border border-border text-foreground`}
							>
								{shortcut.label}
							</button>
						))}
					</div>
				</fieldset>
			) : null}

			<form
				noValidate
				className="flex flex-col gap-1.5"
				onSubmit={(event) => {
					event.preventDefault();
					if (custom === "") {
						setError("Elige la fecha y la hora del aviso.");
						return;
					}
					add(custom);
				}}
			>
				<label htmlFor="aviso-hora" className="text-sm font-medium text-foreground">
					Otra hora
				</label>
				<div className="flex flex-col gap-2 sm:flex-row">
					<input
						id="aviso-hora"
						type="datetime-local"
						value={custom}
						min={epochMsToLocalDateTime(now, APP_TIMEZONE)}
						onChange={(event) => setCustom(event.target.value)}
						aria-invalid={error ? true : undefined}
						aria-describedby={error ? "aviso-hora-error" : undefined}
						className={fieldClass}
					/>
					<button
						type="submit"
						disabled={create.isPending}
						className={`${buttonClass} shrink-0 bg-primary text-primary-foreground`}
					>
						Añadir aviso
					</button>
				</div>
				{error ? (
					<p id="aviso-hora-error" className="text-sm text-destructive">
						{error}
					</p>
				) : null}
			</form>

			{reminders.isPending ? (
				<div role="status" aria-live="polite" className="flex flex-col gap-2">
					<span className="sr-only">Cargando los avisos…</span>
					<Skeleton className="h-11 w-full" />
				</div>
			) : null}

			{reminders.isError ? (
				<div role="alert" className="flex flex-col items-start gap-2">
					<p className="font-medium text-destructive">No se han podido cargar los avisos.</p>
					<button
						type="button"
						className={`${buttonClass} border border-border text-foreground`}
						onClick={() => {
							void reminders.refetch();
						}}
					>
						Reintentar
					</button>
				</div>
			) : null}

			{reminders.data?.length === 0 ? (
				<p className="text-sm text-muted-foreground">Sin avisos.</p>
			) : null}

			{reminders.data && reminders.data.length > 0 ? (
				<ul aria-label="Avisos pendientes" className="flex flex-col">
					{reminders.data.map((reminder) => (
						<ReminderItem key={reminder.id} reminder={reminder} taskId={task.id} now={now} />
					))}
				</ul>
			) : null}
		</>
	);
}

/**
 * Cancelling asks first, in place: the row turns into the question, the same
 * pattern as deleting a task, with no second overlay on top of the sheet.
 */
function ReminderItem({
	reminder,
	taskId,
	now,
}: {
	reminder: Reminder;
	taskId: string;
	now: number;
}) {
	const [confirming, setConfirming] = useState(false);
	const cancel = useCancelReminder(taskId);
	const confirmation = useRef<HTMLLIElement>(null);

	// The question is taller than the row it replaces: on the last reminder of a
	// long sheet its buttons would land below the fold, so they are brought into
	// view. `nearest` moves the sheet only as much as needed, and not at all when
	// they already fit. (jsdom has no `scrollIntoView`, hence the `?.`.)
	useEffect(() => {
		if (confirming) {
			confirmation.current?.scrollIntoView?.({ block: "nearest" });
		}
	}, [confirming]);

	if (confirming) {
		return (
			<li
				ref={confirmation}
				className="flex flex-col gap-2 border-b border-border py-2 last:border-b-0"
			>
				<p className="text-base text-foreground">
					¿Cancelar el aviso {spokenTime(reminder.remind_at, now)}?
				</p>
				<div className="flex flex-col gap-2 sm:flex-row-reverse">
					<button
						type="button"
						disabled={cancel.isPending}
						className={`${buttonClass} border-2 border-destructive text-destructive`}
						onClick={() => cancel.mutate(reminder.id)}
					>
						Cancelar aviso
					</button>
					<button
						type="button"
						className={`${buttonClass} border border-border text-foreground`}
						onClick={() => setConfirming(false)}
					>
						Mantener
					</button>
				</div>
			</li>
		);
	}

	return (
		<li className="flex items-center justify-between gap-2 border-b border-border py-1 last:border-b-0">
			<span className="min-w-0 truncate text-base text-foreground tabular-nums">
				{listedTime(reminder.remind_at, now)}
			</span>
			<button
				type="button"
				aria-label={`Cancelar el aviso ${spokenTime(reminder.remind_at, now)}`}
				className={`${buttonClass} shrink-0 text-destructive`}
				onClick={() => setConfirming(true)}
			>
				Cancelar
			</button>
		</li>
	);
}
