import * as React from "react";

const cn = (...classes: (string | undefined | null | false)[]) => {
	return classes.filter(Boolean).join(" ");
};

interface DialogContextValue {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

const DialogContext = React.createContext<DialogContextValue | null>(null);

const Dialog: React.FC<{
	open?: boolean;
	onOpenChange?: (open: boolean) => void;
	children: React.ReactNode;
}> = ({ open = false, onOpenChange, children }) => {
	return (
		<DialogContext.Provider value={{ open, onOpenChange: onOpenChange || (() => {}) }}>
			{children}
		</DialogContext.Provider>
	);
};

const DialogContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
	({ className, children, ...props }, ref) => {
		const context = React.useContext(DialogContext);

		if (!context?.open) return null;

		return (
			<div className="fixed inset-0 z-50 flex items-center justify-center">
				<div className="fixed inset-0 bg-black/50" onClick={() => context?.onOpenChange(false)} />
				<div
					ref={ref}
					className={cn(
						"relative z-50 grid w-full max-w-lg gap-4 border border-gray-200 bg-white p-6 shadow-lg duration-200 sm:rounded-lg",
						className
					)}
					{...props}
				>
					{children}
				</div>
			</div>
		);
	}
);
DialogContent.displayName = "DialogContent";

const DialogHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
	({ className, ...props }, ref) => (
		<div
			ref={ref}
			className={cn("flex flex-col space-y-1.5 text-center sm:text-left", className)}
			{...props}
		/>
	)
);
DialogHeader.displayName = "DialogHeader";

const DialogTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
	({ className, ...props }, ref) => (
		<h2
			ref={ref}
			className={cn("text-lg font-semibold leading-none tracking-tight", className)}
			{...props}
		/>
	)
);
DialogTitle.displayName = "DialogTitle";

const DialogFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
	({ className, ...props }, ref) => (
		<div
			ref={ref}
			className={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2", className)}
			{...props}
		/>
	)
);
DialogFooter.displayName = "DialogFooter";

export { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter };
