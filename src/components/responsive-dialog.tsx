import { XIcon } from "lucide-react";
import type { ReactNode } from "react";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	Drawer,
	DrawerContent,
	DrawerDescription,
	DrawerFooter,
	DrawerHeader,
	DrawerTitle,
} from "@/components/ui/drawer";
import { useIsDesktop } from "@/lib/use-media-query";

/**
 * The only overlay in the application (docs/DESIGN.md §4): a bottom sheet below
 * 1024 px and a centred dialog from 1024 px up, with the same content and the
 * same actions in both. No view imports `Drawer` or `Dialog` directly, which is
 * what makes "the overlay behaves the same everywhere" a rule instead of a wish.
 *
 * The choice is made in JavaScript on purpose. `Drawer` and `Dialog` are two
 * different Base UI primitives, each with its own focus management, so hiding one
 * with a class would leave two focus traps in the DOM and the hidden one would
 * still fight for the focus (design.md D3).
 */

type ResponsiveDialogProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	title: string;
	description?: string;
	/** Primary actions, rendered at the bottom in both shapes. */
	actions?: ReactNode;
	children?: ReactNode;
	/** Hides the swipe handle of the sheet; a dialog has none. */
	showSwipeHandle?: boolean;
};

export function ResponsiveDialog({
	open,
	onOpenChange,
	title,
	description,
	actions,
	children,
	showSwipeHandle = true,
}: ResponsiveDialogProps) {
	const isDesktop = useIsDesktop();

	// A sheet can be dismissed by dragging or by the backdrop, but "there is a
	// visible button that closes it" is a requirement, not a nicety: it is the way
	// out for anyone who cannot drag, and the only way out with a keyboard and no
	// Escape. 44 × 44 px, like every other control (`responsive-overlays`, "Cerrar
	// con el botón visible").
	const close = (
		<button
			type="button"
			onClick={() => onOpenChange(false)}
			className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors focus-visible:ring-3 focus-visible:ring-ring/50"
		>
			<XIcon aria-hidden="true" className="size-5" />
			<span className="sr-only">Cerrar</span>
		</button>
	);

	return isDesktop ? (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent
				// `dvh`, never `vh`: with the keyboard virtual open, `100vh` stays
				// taller than what is actually visible and hides the actions
				// (docs/DESIGN.md §4).
				className="flex max-h-[calc(100dvh-2rem)] flex-col"
				showCloseButton={false}
			>
				<DialogHeader>
					<DialogTitle>{title}</DialogTitle>
					{description ? <DialogDescription>{description}</DialogDescription> : null}
				</DialogHeader>
				<div className="flex items-start justify-between gap-3">
					<div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</div>
					{close}
				</div>
				{actions ? <DialogFooter>{actions}</DialogFooter> : null}
			</DialogContent>
		</Dialog>
	) : (
		<Drawer open={open} onOpenChange={onOpenChange} showSwipeHandle={showSwipeHandle}>
			<DrawerContent className="max-h-[calc(100dvh-3rem)]">
				{/* Only the top corners are rounded: a sheet is anchored to the bottom
				    edge (docs/DESIGN.md §5). */}
				<DrawerHeader className="flex-row items-start justify-between gap-3">
					<div className="min-w-0 flex-1">
						<DrawerTitle>{title}</DrawerTitle>
						{description ? <DrawerDescription>{description}</DrawerDescription> : null}
					</div>
					{close}
				</DrawerHeader>
				{/* Safe-area padding, so the last action clears the gesture bar. */}
				<div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4">{children}</div>
				{actions ? (
					<DrawerFooter className="pb-[calc(1rem+env(safe-area-inset-bottom))]">
						{actions}
					</DrawerFooter>
				) : null}
			</DrawerContent>
		</Drawer>
	);
}
