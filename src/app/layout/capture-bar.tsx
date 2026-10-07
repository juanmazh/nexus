import { ArrowUpIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * The signature control of Nexus (docs/DESIGN.md §5): always within thumb reach,
 * one tap to write and one to send.
 *
 * The bar empties at once on send, so the next task can be written while the
 * previous one is saved. When `onSubmit` returns a promise that rejects, the text
 * comes back to the field (unless something new was typed meanwhile): a failed
 * save never loses what the person wrote (design.md D10). The field is never
 * blocked; only the button waits, and the bar says it is busy.
 *
 * `N` focuses the field on desktop, where there is no thumb to reach it with.
 * That shortcut yields to typing, to an open overlay and to Ctrl/Cmd/Alt
 * combinations, so it never steals a key the person meant for something else.
 */

const SHORTCUT_KEY = "n";

function isTypingTarget(target: EventTarget | null): boolean {
	if (!(target instanceof HTMLElement)) {
		return false;
	}
	if (target.isContentEditable) {
		return true;
	}
	const tag = target.tagName;
	return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

function hasOverlayOpen(): boolean {
	return (
		document.querySelector('[data-slot="dialog-content"], [data-slot="drawer-popup"]') !== null
	);
}

export function CaptureBar({
	onSubmit,
	placeholder = "Añade algo…",
	className,
}: {
	/** A rejected promise gives the text back to the field. */
	onSubmit?: (text: string) => unknown;
	placeholder?: string;
	className?: string;
}) {
	const inputRef = useRef<HTMLInputElement>(null);
	// A counter, not a flag: two captures can be in flight at once, and the first
	// one to settle must not mark the bar idle while the second is still saving.
	const [pending, setPending] = useState(0);
	const busy = pending > 0;

	useEffect(() => {
		function onKeyDown(event: KeyboardEvent) {
			if (event.key.toLowerCase() !== SHORTCUT_KEY) {
				return;
			}
			// Ctrl+N, Cmd+N and Alt+N belong to the browser and the system.
			if (event.ctrlKey || event.metaKey || event.altKey) {
				return;
			}
			if (isTypingTarget(event.target)) {
				return;
			}
			if (hasOverlayOpen()) {
				return;
			}

			event.preventDefault();
			inputRef.current?.focus();
		}

		document.addEventListener("keydown", onKeyDown);
		return () => document.removeEventListener("keydown", onKeyDown);
	}, []);

	return (
		<form
			data-slot="capture-bar"
			aria-busy={busy}
			className={cn("shrink-0 border-t border-border bg-background", className)}
			onSubmit={(event) => {
				event.preventDefault();
				const input = inputRef.current;
				if (!input) {
					return;
				}
				const text = input.value;
				input.value = "";
				if (text.trim() === "" || !onSubmit) {
					return;
				}
				const result = onSubmit(text);
				if (result instanceof Promise) {
					setPending((count) => count + 1);
					result
						.catch(() => {
							// Only into an empty field: never over what was typed since.
							if (inputRef.current && inputRef.current.value === "") {
								inputRef.current.value = text;
							}
						})
						.finally(() => setPending((count) => count - 1));
				}
			}}
		>
			{/* Shadow: this bar floats over the content, so it is one of the two
			    places DESIGN.md §5 allows one. */}
			<div className="flex items-center gap-2 px-3 py-2 shadow-[0_-1px_0_0_var(--border),0_-8px_16px_-12px_rgb(0_0_0_/_0.25)]">
				<label className="sr-only" htmlFor="captura">
					Añadir algo
				</label>
				<input
					ref={inputRef}
					id="captura"
					name="captura"
					type="text"
					autoComplete="off"
					// Tells the virtual keyboard the action is "send", not "next".
					enterKeyHint="send"
					placeholder={placeholder}
					// 16 px: below that iOS Safari zooms in when the field is focused.
					className="min-h-11 min-w-0 flex-1 rounded-lg border border-input bg-background px-3 text-base text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
				/>
				<button
					type="submit"
					aria-label="Guardar"
					disabled={busy}
					// 44 × 44 px minimum touch area (docs/DESIGN.md §4). Feedback uses
					// `active`, never `hover`: a hover style sticks on touch.
					className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-transform active:scale-95 disabled:opacity-50"
				>
					<ArrowUpIcon aria-hidden="true" className="size-5" />
				</button>
			</div>
		</form>
	);
}
