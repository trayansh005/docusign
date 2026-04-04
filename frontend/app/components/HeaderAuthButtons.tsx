"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/authStore";
import { PendingDocumentsNotification } from "@/components/PendingDocumentsNotification";
import { User } from "@/types/auth";

export default function HeaderAuthButtons({ user }: { user: User | null }) {
	const [isMenuOpen, setIsMenuOpen] = useState(false);
	const router = useRouter();
	const logout = useAuthStore((state) => state.logout);

	const handleLogout = async () => {
		await logout();
		router.push("/login");
	};

	const logoutIcon = (
		<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
			<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
				d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
		</svg>
	);

	return (
		<>
			{/* Desktop nav */}
			<nav className="hidden md:flex items-center space-x-1 text-white">
				{!user ? (
					<>
						<Link href="/subscription" className="nav-link">Pricing</Link>
						<Link href="/login" className="nav-link">Sign In</Link>
						<Link href="/register" className="nav-link">Register</Link>
						<Link href="/fomiqsign/dashboard" className="btn btn-primary ml-4">Get Started</Link>
					</>
				) : (
					<>
						<Link href="/subscription" className="nav-link">Plans</Link>
						<Link href="/dashboard" className="nav-link">Dashboard</Link>
						<Link href="/dashboard/signing-progress" className="nav-link">Signing Progress</Link>
						<Link href="/fomiqsign/dashboard" className="nav-link">Sign Document</Link>
						<PendingDocumentsNotification />
						<div className="flex items-center space-x-3 ml-4 pl-4 border-l border-white/20">
							<Link href="/subscription" className="flex items-center space-x-2 hover:opacity-80 transition-opacity">
								<div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-full flex items-center justify-center text-white text-sm font-semibold">
									{user.firstName?.charAt(0)?.toUpperCase() || "U"}
								</div>
								<div className="hidden lg:block">
									<div className="text-sm font-medium text-white">{user.firstName} {user.lastName}</div>
									<div className="text-xs text-gray-400">{user.email}</div>
								</div>
							</Link>
							<button onClick={handleLogout} className="nav-link hover:text-red-400 transition-colors text-sm" title="Sign Out">
								{logoutIcon}
							</button>
						</div>
					</>
				)}
			</nav>

			{/* Mobile menu button */}
			<button
				className="md:hidden relative w-6 h-6 text-gray-300 hover:text-white transition-colors duration-200"
				onClick={() => setIsMenuOpen(!isMenuOpen)}
				aria-label="Toggle menu"
			>
				<div className={`absolute inset-0 flex flex-col justify-center space-y-1 transition-all duration-200 ${isMenuOpen ? "rotate-45" : ""}`}>
					<span className={`block h-0.5 bg-current rounded transition-all duration-200 ${isMenuOpen ? "rotate-90 translate-y-1.5" : "w-6"}`} />
					<span className={`block h-0.5 bg-current rounded transition-all duration-200 ${isMenuOpen ? "opacity-0" : "w-6"}`} />
					<span className={`block h-0.5 bg-current rounded transition-all duration-200 ${isMenuOpen ? "-rotate-90 -translate-y-1.5" : "w-6"}`} />
				</div>
			</button>

			{/* Mobile nav */}
			<div className={`md:hidden fixed top-16 left-0 right-0 z-40 bg-black/90 backdrop-blur-xl border-b border-white/10 overflow-hidden transition-all duration-300 ${isMenuOpen ? "max-h-96 pb-4" : "max-h-0"}`}>
				<nav className="flex flex-col space-y-2 pt-4 px-4">
					{!user ? (
						<>
							<Link href="/subscription" className="nav-link text-center" onClick={() => setIsMenuOpen(false)}>Pricing</Link>
							<Link href="/login" className="nav-link text-center" onClick={() => setIsMenuOpen(false)}>Sign In</Link>
							<Link href="/register" className="nav-link text-center" onClick={() => setIsMenuOpen(false)}>Register</Link>
							<Link href="/fomiqsign/dashboard" className="btn btn-primary mx-auto mt-2" onClick={() => setIsMenuOpen(false)}>Get Started</Link>
						</>
					) : (
						<>
							<div className="flex flex-col items-center space-y-2 py-3 border-b border-white/10 mb-3">
								<div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-full flex items-center justify-center text-white text-lg font-semibold">
									{user.firstName?.charAt(0)?.toUpperCase() || "U"}
								</div>
								<div className="text-center">
									<div className="text-white font-medium">{user.firstName} {user.lastName}</div>
									<div className="text-sm text-gray-400">{user.email}</div>
								</div>
							</div>
							<Link href="/subscription" className="nav-link text-center" onClick={() => setIsMenuOpen(false)}>Plans</Link>
							<Link href="/dashboard" className="nav-link text-center flex items-center justify-center gap-2" onClick={() => setIsMenuOpen(false)}>
								Dashboard <PendingDocumentsNotification badgeOnly />
							</Link>
							<Link href="/dashboard/signing-progress" className="nav-link text-center" onClick={() => setIsMenuOpen(false)}>Signing Progress</Link>
							<Link href="/fomiqsign/dashboard" className="nav-link text-center" onClick={() => setIsMenuOpen(false)}>Sign Document</Link>
							<hr className="border-white/10 my-2" />
							<button
								onClick={() => { setIsMenuOpen(false); handleLogout(); }}
								className="nav-link text-center hover:text-red-400 transition-colors flex items-center justify-center space-x-2"
							>
								{logoutIcon}
								<span>Sign Out</span>
							</button>
						</>
					)}
				</nav>
			</div>
		</>
	);
}
