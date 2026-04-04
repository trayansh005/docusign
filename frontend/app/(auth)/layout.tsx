import { Toaster } from "sonner";
import { Providers } from "@/components/Providers";

// Bare layout for auth pages (login, register) and full-screen pages (viewer).
// No header or footer.
export default function AuthLayout({ children }: { children: React.ReactNode }) {
	return (
		<Providers>
			<main className="flex-1 relative z-10">{children}</main>
			<Toaster theme="dark" position="top-right" richColors closeButton />
		</Providers>
	);
}
