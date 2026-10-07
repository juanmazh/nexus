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

	return isDesktop ? (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent
				// `dvh`, never `vh`: with the keyboard virtual open, `100vh` stays
				// taller than what is actually visible and hides the actions
				// (docs/DESIGN.md §4).
				className="flex max-h-[calc(100dvh-2rem)] flex-col"
			>
				<DialogHeader>
					<DialogTitle>{title}</DialogTitle>
					{description ? <DialogDescription>{description}</DialogDescription> : null}
				</DialogHeader>
				<div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</div>
				{actions ? <DialogFooter>{actions}</DialogFooter> : null}
			</DialogContent>
		</Dialog>
	) : (
		<Drawer open={open} onOpenChange={onOpenChange} showSwipeHandle={showSwipeHandle}>
			<DrawerContent className="max-h-[calc(100dvh-3rem)]">
				{/* Only the top corners are rounded: a sheet is anchored to the bottom
				    edge (docs/DESIGN.md §5). */}
				<DrawerHeader>
					<DrawerTitle>{title}</DrawerTitle>
					{description ? <DrawerDescription>{description}</DrawerDescription> : null}
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
