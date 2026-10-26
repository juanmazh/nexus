import { describe, expect, it } from "vitest";
import { renderMarkdown } from "./markdown";

describe("renderMarkdown", () => {
	it("renders GFM: lists, task boxes, tables and code", () => {
		const html = renderMarkdown(
			"- [ ] pan\n- [x] leche\n\n| a | b |\n|---|---|\n| 1 | 2 |\n\n```\ncódigo\n```",
		);

		expect(html).toContain("<ul>");
		expect(html).toContain('type="checkbox"');
		expect(html).toContain("<table>");
		expect(html).toContain("<pre><code>código");
	});

	it("moves headings one level down, so the page keeps a single h1", () => {
		expect(renderMarkdown("# Uno\n###### Seis")).toBe("<h2>Uno</h2>\n<h6>Seis</h6>\n");
	});

	it("opens links in another tab without access to this one", () => {
		const html = renderMarkdown("[web](https://example.test)");

		expect(html).toContain('href="https://example.test"');
		expect(html).toContain('target="_blank"');
		expect(html).toContain('rel="noopener noreferrer"');
	});

	it.each([
		["<script>alert(1)</script>", "<script"],
		['<img src="x" onerror="alert(1)">', "onerror"],
		["[clic](javascript:alert(1))", "javascript:"],
		['<a href="#" style="position:fixed">x</a>', "style="],
		['<iframe src="https://example.test"></iframe>', "<iframe"],
		["<form><input name=x></form>", "<form"],
		['<a id="root" href="#x">x</a>', 'id="root"'],
		["<button>Pulsa</button>", "<button"],
	])("removes %j", (source, forbidden) => {
		expect(renderMarkdown(source)).not.toContain(forbidden);
	});

	it("turns a single line break into a break, as people write notes", () => {
		expect(renderMarkdown("uno\ndos")).toContain("uno<br>dos");
	});
});
