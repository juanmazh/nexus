import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router/dom";
import { Providers } from "@/app/providers";
import { router } from "@/app/router";
import { installStaleChunkReload } from "@/lib/stale-chunk";
import { applyTheme } from "@/lib/theme";
import "@/index.css";

const container = document.getElementById("root");
if (!container) {
	throw new Error("No se encuentra el elemento #root en index.html.");
}

// Before the first render, so the very first paint already uses the right
// tokens. An inline script would do it even earlier, but the CSP has no
// 'unsafe-inline' in script-src (design.md D5).
applyTheme(document);

// Before the router asks for its first section: an installed app that outlived
// a deploy reloads instead of failing to open a section (reload-on-stale-chunk).
installStaleChunkReload();

createRoot(container).render(
	<StrictMode>
		<Providers>
			<RouterProvider router={router} />
		</Providers>
	</StrictMode>,
);
