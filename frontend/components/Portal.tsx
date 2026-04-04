"use client";
import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";

export function Portal({ children }: { children: React.ReactNode }) {
	const [mounted, setMounted] = useState(false);
	const [container, setContainer] = useState<HTMLDivElement | null>(null);

	useEffect(() => {
		const el = document.createElement("div");
		el.setAttribute("data-portal", "true");
		document.body.appendChild(el);
		setContainer(el);
		setMounted(true);
		return () => {
			document.body.removeChild(el);
		};
	}, []);

	if (!mounted || !container) return null;
	return createPortal(children, container);
}
