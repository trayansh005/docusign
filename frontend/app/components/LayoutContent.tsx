"use client";

import React, { useEffect, useState } from "react";
import Footer from "./Footer";
import { Toaster } from "sonner";
import { usePathname } from "next/navigation";

// Header is rendered as a server component directly in layout.tsx.
// LayoutContent only handles footer visibility and toaster.
export default function LayoutContent({ children }: { children: React.ReactNode }) {
	const pathname = usePathname();
	const [isClient, setIsClient] = useState(false);

	useEffect(() => {
		setIsClient(true);
	}, []);

	const shouldShowFooter = isClient && pathname !== "/fomiqsign/dashboard/viewer";

	return (
		<>
			<main className="flex-1 relative z-10">{children}</main>
			{shouldShowFooter && <Footer />}
			<Toaster theme="dark" position="top-right" richColors closeButton />
		</>
	);
}
