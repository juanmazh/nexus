import { ArrowUpIcon } from "lucide-react";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

/**
 * The signature control of Nexus (docs/DESIGN.md §5): always within thumb reach,
 * one tap to write and one to send.
 *
 * In this change it is **only the interface**: `onSubmit` is optional and the
 * component persists nothing and calls no API. `add-tasks` is what connects it,
 * and until then submitting simply empties the field, so the shortcut can be felt
 * before there is anything behind it.
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
	/** Left out until `add-tasks` connects the bar to the API. */
	onSubmit?: (text: string) => void;
	placeholder?: string;
	className?: string;
}) {
	const inputRef = useRef<HTMLInputElement>(null);

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
			className={cn("shrink-0 border-t border-border bg-background", className)}
			onSubmit={(event) => {
				event.preventDefault();
				const input = inputRef.current;
				if (!input) {
					return;
				}
				if (input.value.trim() !== "") {
					onSubmit?.(input.value);
				}
				input.value = "";
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
