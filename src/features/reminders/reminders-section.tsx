import { epochMsToLocalDateTime, zonedDayNumber } from "@shared/dates";
import { formatShortDate, formatTime } from "@shared/format";
import { describeInterval, MAX_REPEAT_EVERY, type RepeatUnit } from "@shared/recurrence";
import { repeatSchema } from "@shared/reminders";
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

const HOUR_MS = 3_600_000;

/** The repetition of a reminder, or `null` for a one-off one. */
function repeatOf(reminder: Reminder): { every: number; unit: RepeatUnit } | null {
	return reminder.repeat_every !== null && reminder.repeat_unit !== null
		? { every: reminder.repeat_every, unit: reminder.repeat_unit }
		: null;
}

/** "Hoy, 18:00" → "hoy, 18:00", after "Próximo:". */
function lowerFirst(text: string): string {
	return text.charAt(0).toLowerCase() + text.slice(1);
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
	const [shortcutError, setShortcutError] = useState<string | null>(null);

	/**
	 * Each source of a time reports its own rejection: a refused shortcut must
	 * not mark the "Otra hora" field as invalid when the person never touched it.
	 */
	function add(remindAt: string, from: "shortcut" | "field") {
		setError(null);
		setShortcutError(null);
		create.mutate(
			{ remind_at: remindAt },
			{
				onSuccess: () => setCustom(""),
				onError: (failure) => (from === "field" ? setError : setShortcutError)(failure.message),
			},
		);
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
								onClick={() => add(shortcut.value, "shortcut")}
								className={`${buttonClass} rounded-full border border-border text-foreground`}
							>
								{shortcut.label}
							</button>
						))}
					</div>
				</fieldset>
			) : null}

			{shortcutError ? (
				<p role="alert" className="text-sm text-destructive">
					{shortcutError}
				</p>
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
					add(custom, "field");
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

			<RepeatForm taskId={task.id} now={now} />

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
 * "Repetir": every N hours or days from a first time (add-recurring-reminders
 * design.md D6). It starts at the next whole hour, which is what "remind me
 * every two hours" usually means, and is one tap away from any other time.
 *
 * The interval is checked here with the shared schema, so its error lands next
 * to "Cada"; what only the Worker can judge (a time that has passed or does not
 * exist, the limit of pending reminders) lands next to "Primera vez".
 */
function RepeatForm({ taskId, now }: { taskId: string; now: number }) {
	const create = useCreateReminder(taskId);
	const [every, setEvery] = useState("2");
	const [unit, setUnit] = useState<RepeatUnit>("hours");
	const [from, setFrom] = useState(() =>
		epochMsToLocalDateTime(Math.ceil((now + 1) / HOUR_MS) * HOUR_MS, APP_TIMEZONE),
	);
	const [everyError, setEveryError] = useState<string | null>(null);
	const [fromError, setFromError] = useState<string | null>(null);

	return (
		<form
			noValidate
			aria-labelledby="repetir-titulo"
			className="flex flex-col gap-3 rounded-lg border border-border p-3"
			onSubmit={(event) => {
				event.preventDefault();
				setEveryError(null);
				setFromError(null);
				const repeat = repeatSchema.safeParse({
					every: every === "" ? undefined : Number(every),
					unit,
				});
				if (!repeat.success) {
					setEveryError(repeat.error.issues[0]?.message ?? "Revisa el intervalo.");
					return;
				}
				if (from === "") {
					setFromError("Elige cuándo es la primera vez.");
					return;
				}
				create.mutate(
					{ remind_at: from, repeat: repeat.data },
					{ onError: (failure) => setFromError(failure.message) },
				);
			}}
		>
			<h4 id="repetir-titulo" className="text-sm font-medium text-foreground">
				Repetir
			</h4>
			<p className="text-sm text-muted-foreground">
				Te lo recuerda hasta que completes la tarea, salvo en el silencio nocturno.
			</p>

			<div className="flex flex-col gap-1.5">
				<label htmlFor="repetir-cada" className="text-sm font-medium text-foreground">
					Cada
				</label>
				<div className="flex gap-2">
					<div className="w-24 flex-none">
						<input
							id="repetir-cada"
							type="number"
							inputMode="numeric"
							min={1}
							max={MAX_REPEAT_EVERY[unit]}
							step={1}
							value={every}
							onChange={(event) => setEvery(event.target.value)}
							aria-invalid={everyError ? true : undefined}
							aria-describedby={everyError ? "repetir-cada-error" : undefined}
							className={fieldClass}
						/>
					</div>
					<select
						aria-label="Unidad"
						value={unit}
						onChange={(event) => setUnit(event.target.value as RepeatUnit)}
						className={`${fieldClass} flex-1`}
					>
						<option value="hours">horas</option>
						<option value="days">días</option>
					</select>
				</div>
				{everyError ? (
					<p id="repetir-cada-error" className="text-sm text-destructive">
						{everyError}
					</p>
				) : null}
			</div>

			<div className="flex flex-col gap-1.5">
				<label htmlFor="repetir-desde" className="text-sm font-medium text-foreground">
					Primera vez
				</label>
				<input
					id="repetir-desde"
					type="datetime-local"
					value={from}
					min={epochMsToLocalDateTime(now, APP_TIMEZONE)}
					onChange={(event) => setFrom(event.target.value)}
					aria-invalid={fromError ? true : undefined}
					aria-describedby={fromError ? "repetir-desde-error" : undefined}
					className={fieldClass}
				/>
				{fromError ? (
					<p id="repetir-desde-error" className="text-sm text-destructive">
						{fromError}
					</p>
				) : null}
			</div>

			<button
				type="submit"
				disabled={create.isPending}
				className={`${buttonClass} border border-border text-foreground sm:self-start`}
			>
				Añadir repetición
			</button>
		</form>
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
	const repeat = repeatOf(reminder);
	const interval = repeat ? describeInterval(repeat.every, repeat.unit) : null;
	/** What the confirmation and the button call it. */
	const subject = interval
		? `la repetición ${interval}`
		: `el aviso ${spokenTime(reminder.remind_at, now)}`;

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
				<p className="text-base text-foreground">¿Cancelar {subject}?</p>
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
			{interval ? (
				<span className="flex min-w-0 flex-col py-1">
					<span className="text-base text-foreground">
						<span aria-hidden="true">🔁 </span>Se repite {interval}
					</span>
					<span className="text-sm text-muted-foreground tabular-nums">
						Próximo: {lowerFirst(listedTime(reminder.remind_at, now))}
					</span>
				</span>
			) : (
				<span className="min-w-0 truncate text-base text-foreground tabular-nums">
					{listedTime(reminder.remind_at, now)}
				</span>
			)}
			<button
				type="button"
				aria-label={`Cancelar ${subject}`}
				className={`${buttonClass} shrink-0 text-destructive`}
				onClick={() => setConfirming(true)}
			>
				Cancelar
			</button>
		</li>
	);
}
