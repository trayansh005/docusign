import { Toaster } from "sonner";

// Register page has no header or footer
export default function RegisterLayout({ children }: { children: React.ReactNode }) {
	return (
		<>
			<main className="flex-1 relative z-10">{children}</main>
			<Toaster theme="dark" position="top-right" richColors closeButton />
		</>
	);
}
