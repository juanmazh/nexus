/**
 * The text of a note that the API does not have yet, kept in the browser
 * (add-notes design.md D6). It is what makes "the text is never lost" true
 * when a save fails after leaving the note, or when the phone kills the app
 * offline: the next time the note opens, the editor starts from it and saves
 * it. Every access is guarded: private mode or blocked storage only lose this
 * safety net, never the note.
 */

const PREFIX = "nexus:note-draft:";

export function readDraft(id: string): string | null {
	try {
		return localStorage.getItem(PREFIX + id);
	} catch {
		return null;
	}
}

export function writeDraft(id: string, content: string): void {
	try {
		localStorage.setItem(PREFIX + id, content);
	} catch {
		// Full or blocked: the editor still has the text on screen.
	}
}

export function clearDraft(id: string): void {
	try {
		localStorage.removeItem(PREFIX + id);
	} catch {
		// Nothing to clear.
	}
}
