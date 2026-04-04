import { Toaster } from "sonner";

// Viewer page is full-screen — no header or footer
export default function ViewerLayout({ children }: { children: React.ReactNode }) {
	return (
		<>
			<main className="flex-1 relative z-10">{children}</main>
			<Toaster theme="dark" position="top-right" richColors closeButton />
		</>
	);
}
