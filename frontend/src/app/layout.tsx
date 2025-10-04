import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono, Dancing_Script } from "next/font/google";
import "./globals.css";
import LayoutContent from "./components/LayoutContent";
import { AuthProvider } from "@/contexts/AuthContext";
import { Providers } from "@/components/Providers";

const inter = Inter({
	variable: "--font-inter",
	subsets: ["latin"],
	display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
	variable: "--font-jetbrains-mono",
	subsets: ["latin"],
	display: "swap",
});

const dancingScript = Dancing_Script({
	variable: "--font-dancing-script",
	subsets: ["latin"],
	display: "swap",
});

export const metadata: Metadata = {
	title: "FomiqSign Integration Platform",
	description: "Modern platform for secure document signing and subscription management",
	keywords: ["FomiqSign", "Digital Signatures", "Document Management", "Subscription Platform"],
	authors: [{ name: "FomiqSign Team" }],
};

export const viewport: Viewport = {
	width: "device-width",
	initialScale: 1,
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="en" className="dark">
			<body
				className={`${inter.variable} ${jetbrainsMono.variable} ${dancingScript.variable} min-h-screen flex flex-col scrollbar-thin`}
			>
				<div className="fixed inset-0 bg-gradient-to-br from-slate-900 via-gray-900 to-black -z-10" />
				<div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900/20 via-transparent to-transparent -z-10" />

				<Providers>
					<AuthProvider>
						<LayoutContent>{children}</LayoutContent>
					</AuthProvider>
				</Providers>

				{/* Background Elements */}
				<div className="fixed top-0 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-pulse -z-10" />
				<div className="fixed bottom-0 right-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl animate-pulse -z-10" />
			</body>
		</html>
	);
}
