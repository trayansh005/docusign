import * as React from "react";

const cn = (...classes: (string | undefined | null | false)[]) => {
	return classes.filter(Boolean).join(" ");
};

interface TabsContextValue {
	value: string;
	onValueChange: (value: string) => void;
}

const TabsContext = React.createContext<TabsContextValue | null>(null);

const Tabs: React.FC<{
	value: string;
	onValueChange: (value: string) => void;
	className?: string;
	children: React.ReactNode;
}> = ({ value, onValueChange, className, children }) => {
	return (
		<TabsContext.Provider value={{ value, onValueChange }}>
			<div className={cn("w-full", className)}>{children}</div>
		</TabsContext.Provider>
	);
};

const TabsList = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
	({ className, ...props }, ref) => (
		<div
			ref={ref}
			className={cn(
				"inline-flex h-10 items-center justify-center rounded-md bg-gray-100 p-1 text-gray-500",
				className
			)}
			{...props}
		/>
	)
);
TabsList.displayName = "TabsList";

const TabsTrigger = React.forwardRef<
	HTMLButtonElement,
	React.ButtonHTMLAttributes<HTMLButtonElement> & { value: string }
>(({ className, value, disabled, ...props }, ref) => {
	const context = React.useContext(TabsContext);
	const isActive = context?.value === value;

	return (
		<button
			ref={ref}
			className={cn(
				"inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-white transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
				isActive ? "bg-white text-gray-950 shadow-sm" : "hover:bg-white/50 hover:text-gray-950",
				className
			)}
			onClick={() => !disabled && context?.onValueChange(value)}
			disabled={disabled}
			{...props}
		/>
	);
});
TabsTrigger.displayName = "TabsTrigger";

const TabsContent = React.forwardRef<
	HTMLDivElement,
	React.HTMLAttributes<HTMLDivElement> & { value: string }
>(({ className, value, ...props }, ref) => {
	const context = React.useContext(TabsContext);

	if (context?.value !== value) return null;

	return (
		<div
			ref={ref}
			className={cn(
				"mt-2 ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2",
				className
			)}
			{...props}
		/>
	);
});
TabsContent.displayName = "TabsContent";

export { Tabs, TabsList, TabsTrigger, TabsContent };
