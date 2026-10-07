import { Toaster, toast } from "@/components/ui/toast";

/**
 * The single place temporary notices appear in the whole application
 * (docs/DESIGN.md §4). Features import `toast` from here, so there is never a
 * second host competing for the same corner.
 *
 * The position lives in `src/index.css` (`[data-slot="toast-viewport"]`), not in
 * inline styles: above on mobile, where the tab bar and the capture bar live, and
 * bottom-right from 1024 px up (design.md D4).
 */
export function ToastHost() {
	return <Toaster />;
}

export { toast };
