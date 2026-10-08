import { useSendTestMessage } from "./use-reminders";

/**
 * "Enviar aviso de prueba": checks the Telegram secrets the day of the deploy,
 * without waiting for the cron (add-reminders design.md D12). The result is
 * announced through the app's single toast host.
 */
export function TestMessagePanel() {
	const send = useSendTestMessage();

	return (
		<section aria-labelledby="avisos-prueba-titulo" className="flex flex-col gap-3">
			<h2 id="avisos-prueba-titulo" className="font-heading text-base font-medium text-foreground">
				Avisos
			</h2>
			<p className="text-sm text-muted-foreground">
				Manda un mensaje a tu Telegram ahora mismo para comprobar que los recordatorios llegarán.
			</p>
			<button
				type="button"
				disabled={send.isPending}
				onClick={() => send.mutate()}
				className="inline-flex min-h-11 items-center self-start rounded-lg border border-border px-4 text-base font-medium text-foreground active:scale-[0.98] disabled:opacity-60"
			>
				{send.isPending ? "Enviando…" : "Enviar aviso de prueba"}
			</button>
		</section>
	);
}
