import "../globals.css";
import { Providers } from "@/components/Providers";
import { Toaster } from "sonner";

// Bare root layout — no header, no footer.
// Used for login, register, and full-screen pages like the document viewer.
export default function AuthLayout({ children }: { children: React.ReactNode }) {
	return (
		<html lang="en" className="dark">
			<body className="min-h-screen flex flex-col scrollbar-thin">
				<div className="fixed inset-0 bg-gradient-to-br from-slate-900 via-gray-900 to-black -z-10" />
				<div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900/20 via-transparent to-transparent -z-10" />
				<Providers>
					<main className="flex-1 relative z-10">{children}</main>
					<Toaster theme="dark" position="top-right" richColors closeButton />
				</Providers>
			</body>
		</html>
	);
}
