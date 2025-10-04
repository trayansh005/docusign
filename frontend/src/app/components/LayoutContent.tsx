"use client";

import React, { useEffect, useState } from "react";
import Header from "./Header";
import Footer from "./Footer";
import { Toaster } from "sonner";
import { usePathname } from "next/navigation";

export default function LayoutContent({ children }: { children: React.ReactNode }) {
	const pathname = usePathname();
	const [isClient, setIsClient] = useState(false);

	useEffect(() => {
		setIsClient(true);
	}, []);

	// Hide header on login and register pages
	const shouldShowHeader = isClient && !["/login", "/register"].includes(pathname);

	return (
		<>
			{shouldShowHeader && <Header />}
			<main className="flex-1 relative z-10">{children}</main>
			<Footer />
			<Toaster theme="dark" position="top-right" richColors closeButton />
		</>
	);
}
