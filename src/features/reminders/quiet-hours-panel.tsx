import { DEFAULT_QUIET_HOURS } from "@shared/recurrence";
import { quietHoursSchema } from "@shared/reminders";
import { useState } from "react";
import { Skeleton } from "@/components/skeleton";
import { useQuietHours, useSaveQuietHours } from "./use-reminders";

const fieldClass =
	"min-h-11 w-full min-w-0 rounded-lg border border-input bg-background px-3 text-base text-foreground tabular-nums focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60 aria-invalid:border-destructive";
const buttonClass =
	"inline-flex min-h-11 items-center self-start rounded-lg border border-border px-4 text-base font-medium text-foreground active:scale-[0.98] disabled:opacity-60";

/**
 * "Silencio nocturno" (add-recurring-reminders design.md D3, D6): the window in
 * which repetitions do not go off. It only applies to recurring reminders; a
 * one-off reminder rings at the time it was asked for.
 */
export function QuietHoursPanel() {
	const quiet = useQuietHours();

	return (
		<section aria-labelledby="silencio-titulo" className="flex flex-col gap-3">
			<h2 id="silencio-titulo" className="font-heading text-base font-medium text-foreground">
				Silencio nocturno
			</h2>
			<p className="text-sm text-muted-foreground">
				Las repeticiones no suenan en esta franja: la que caiga dentro llega al terminar. Los avisos
				puntuales llegan siempre a su hora.
			</p>

			{quiet.isPending ? (
				<div role="status" aria-live="polite" className="flex flex-col gap-2">
					<span className="sr-only">Cargando el silencio nocturno…</span>
					<Skeleton className="h-11 w-full" />
				</div>
			) : null}

			{quiet.isError ? (
				<div role="alert" className="flex flex-col items-start gap-2">
					<p className="font-medium text-destructive">
						No se ha podido cargar el silencio nocturno.
					</p>
					<button
						type="button"
						className={buttonClass}
						onClick={() => {
							void quiet.refetch();
						}}
					>
						Reintentar
					</button>
				</div>
			) : null}

			{quiet.isSuccess ? <QuietHoursForm saved={quiet.data} /> : null}
		</section>
	);
}

/**
 * Starts from what the server has. Turning the switch off keeps the hours on
 * screen, so turning it back on before saving does not lose them.
 */
function QuietHoursForm({ saved }: { saved: { start: string; end: string } | null }) {
	const save = useSaveQuietHours();
	const [enabled, setEnabled] = useState(saved !== null);
	const [start, setStart] = useState(saved?.start ?? DEFAULT_QUIET_HOURS.start);
	const [end, setEnd] = useState(saved?.end ?? DEFAULT_QUIET_HOURS.end);
	const [error, setError] = useState<string | null>(null);

	const describedBy = error ? "silencio-error" : undefined;

	return (
		<form
			noValidate
			aria-labelledby="silencio-titulo"
			className="flex flex-col gap-3"
			onSubmit={(event) => {
				event.preventDefault();
				setError(null);
				const parsed = quietHoursSchema.safeParse(enabled ? { start, end } : null);
				if (!parsed.success) {
					setError(parsed.error.issues[0]?.message ?? "Revisa las horas.");
					return;
				}
				save.mutate(parsed.data, { onError: (failure) => setError(failure.message) });
			}}
		>
			<label className="flex min-h-11 items-center justify-between gap-3 text-base text-foreground">
				Activar el silencio nocturno
				<input
					type="checkbox"
					role="switch"
					aria-checked={enabled}
					checked={enabled}
					onChange={(event) => setEnabled(event.target.checked)}
					className="size-6 accent-primary"
				/>
			</label>

			<div className="grid grid-cols-2 gap-2">
				<div className="flex min-w-0 flex-col gap-1.5">
					<label htmlFor="silencio-desde" className="text-sm font-medium text-foreground">
						Desde
					</label>
					<input
						id="silencio-desde"
						type="time"
						value={start}
						disabled={!enabled}
						onChange={(event) => setStart(event.target.value)}
						aria-invalid={error ? true : undefined}
						aria-describedby={describedBy}
						className={fieldClass}
					/>
				</div>
				<div className="flex min-w-0 flex-col gap-1.5">
					<label htmlFor="silencio-hasta" className="text-sm font-medium text-foreground">
						Hasta
					</label>
					<input
						id="silencio-hasta"
						type="time"
						value={end}
						disabled={!enabled}
						onChange={(event) => setEnd(event.target.value)}
						aria-invalid={error ? true : undefined}
						aria-describedby={describedBy}
						className={fieldClass}
					/>
				</div>
			</div>

			{error ? (
				<p id="silencio-error" className="text-sm text-destructive">
					{error}
				</p>
			) : null}

			<button type="submit" disabled={save.isPending} className={buttonClass}>
				{save.isPending ? "Guardando…" : "Guardar"}
			</button>
		</form>
	);
}
