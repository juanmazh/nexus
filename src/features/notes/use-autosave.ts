import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "@/components/toast-host";
import { deleteNote, type Note, updateNote } from "./api";
import { noteKey, rememberNote } from "./use-notes";

/**
 * Autosave of a note's content (add-notes design.md D6).
 *
 * - One save a second after the last keystroke, and one right away when asked
 *   (`flush`): going back to the formatted view, leaving the note, or the app
 *   going to the background.
 * - Never two saves at once. A save that finishes finds out whether the text
 *   changed meanwhile and, if so, sends only the latest one.
 * - A failed save keeps the text on screen and offers to try again.
 * - A note left blank is not saved; leaving it deletes it.
 *
 * The state that the timers and the cleanup read lives in refs: they run
 * outside React's render and must see the latest text, not the one of the
 * render that scheduled them.
 */

export type SaveStatus = "idle" | "pending" | "saving" | "saved" | "error";

export const AUTOSAVE_DELAY_MS = 1000;

export function useAutosave(note: Note, delayMs = AUTOSAVE_DELAY_MS) {
	const queryClient = useQueryClient();
	const [draft, setDraftState] = useState(note.content);
	const [status, setStatus] = useState<SaveStatus>("idle");

	const draftRef = useRef(note.content);
	/** What the API has: the text of the last save that succeeded. */
	const savedRef = useRef(note.content);
	const inFlightRef = useRef(false);
	/** Touched at least once: an untouched note is never deleted for being blank. */
	const dirtyRef = useRef(false);
	/** Deleted on purpose: nothing may be saved or deleted for it any more. */
	const discardedRef = useRef(false);
	const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
	const { id } = note;

	const flush = useCallback(async (): Promise<void> => {
		clearTimeout(timerRef.current);
		const content = draftRef.current;
		if (discardedRef.current || content === savedRef.current || content.trim() === "") {
			return;
		}
		if (inFlightRef.current) {
			// The save in flight checks the text again when it finishes.
			return;
		}

		inFlightRef.current = true;
		setStatus("saving");
		try {
			const saved = await updateNote(id, { content });
			savedRef.current = content;
			inFlightRef.current = false;
			void rememberNote(queryClient, saved);
			if (draftRef.current !== content) {
				await flush();
			} else {
				setStatus("saved");
			}
		} catch {
			inFlightRef.current = false;
			setStatus("error");
		}
	}, [id, queryClient]);

	const setDraft = useCallback(
		(value: string) => {
			draftRef.current = value;
			dirtyRef.current = true;
			setDraftState(value);
			setStatus(value === savedRef.current ? "saved" : "pending");
			clearTimeout(timerRef.current);
			timerRef.current = setTimeout(() => {
				void flush();
			}, delayMs);
		},
		[flush, delayMs],
	);

	/** For a note deleted from its own menu: leaving it must not touch it again. */
	const discard = useCallback(() => {
		discardedRef.current = true;
		clearTimeout(timerRef.current);
	}, []);

	// Switching apps on a phone hides the page; it may never come back.
	useEffect(() => {
		const onHide = () => {
			if (document.visibilityState === "hidden") {
				void flush();
			}
		};
		document.addEventListener("visibilitychange", onHide);
		window.addEventListener("pagehide", onHide);
		return () => {
			document.removeEventListener("visibilitychange", onHide);
			window.removeEventListener("pagehide", onHide);
		};
	}, [flush]);

	// Leaving the note: save what is left, or delete it if it was emptied.
	useEffect(
		() => () => {
			clearTimeout(timerRef.current);
			if (discardedRef.current) {
				return;
			}
			if (dirtyRef.current && draftRef.current.trim() === "") {
				discardedRef.current = true;
				void deleteNote(id)
					.then(() => {
						queryClient.removeQueries({ queryKey: noteKey(id) });
						toast.add({ title: "Nota vacía eliminada" });
						return queryClient.invalidateQueries({ queryKey: ["notes", "list"] });
					})
					.catch(() => {
						// Nothing to undo: the note keeps its last saved text.
					});
				return;
			}
			void flush();
		},
		[flush, id, queryClient],
	);

	return { draft, setDraft, status, flush, discard };
}
