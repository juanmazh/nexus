import DOMPurify from "dompurify";
import { Marked } from "marked";

/**
 * Markdown → HTML that is safe to put in the page (add-notes design.md D5).
 *
 * `marked` does not sanitize, on purpose: its output goes through DOMPurify,
 * which removes scripts, event handlers, `javascript:` links and anything else
 * that could run. The note is the owner's own text, but it is still text that
 * may have been pasted from anywhere.
 */

const parser = new Marked({ gfm: true, breaks: true, async: false });

/**
 * The page already has its `h1`, the title of the note, so a `#` in the text
 * becomes an `h2`, and so on: one `h1` per page for assistive technology.
 */
parser.use({
	renderer: {
		heading({ tokens, depth }) {
			const level = Math.min(depth + 1, 6);
			return `<h${level}>${this.parser.parseInline(tokens)}</h${level}>\n`;
		},
	},
});

/**
 * Every link of a note opens outside the app: following one inside the
 * installed app would leave it with no way back. `noopener noreferrer` so the
 * other page can neither reach this one nor learn its address.
 */
DOMPurify.addHook("afterSanitizeAttributes", (node) => {
	if (node.tagName === "A" && node.hasAttribute("href")) {
		node.setAttribute("target", "_blank");
		node.setAttribute("rel", "noopener noreferrer");
	}
});

export function renderMarkdown(source: string): string {
	const html = parser.parse(source) as string;
	return DOMPurify.sanitize(html, {
		USE_PROFILES: { html: true },
		// Styles and controls have no business in a note: `style` could make
		// something look like part of the app, and an `id` or `name` could clash
		// with the app's own (`#root`). The task boxes of GFM are the only
		// `input`, and marked writes them disabled.
		FORBID_TAGS: ["style", "form", "button", "select", "textarea"],
		FORBID_ATTR: ["style", "id", "name"],
	});
}
