"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import Link from "next/link";

export default function Dashboard() {
	const { user, isAuthenticated, isLoading } = useAuth();
	const router = useRouter();

	useEffect(() => {
		if (!isLoading && !isAuthenticated) {
			router.push("/login");
		}
	}, [isAuthenticated, isLoading, router]);

	if (isLoading) {
		return (
			<div className="min-h-screen bg-gradient-main flex items-center justify-center">
				<div className="text-center">
					<div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
					<p className="text-white">Loading...</p>
				</div>
			</div>
		);
	}

	if (!isAuthenticated) {
		return null; // Will redirect
	}

	return (
		<div className="min-h-screen bg-gradient-main">
			<div className="container mx-auto px-4 py-12">
				<div className="max-w-4xl mx-auto">
					{/* Welcome Section */}
					<div className="card mb-8">
						<div className="text-center">
							<div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-full flex items-center justify-center text-white text-3xl font-bold mx-auto mb-4">
								{user?.firstName?.charAt(0)?.toUpperCase() || "U"}
							</div>
							<h1 className="text-3xl font-bold text-white mb-2">
								Welcome back, {user?.firstName}!
							</h1>
							<p className="text-gray-400">
								Manage your documents and subscriptions from your dashboard.
							</p>
						</div>
					</div>

					{/* Quick Actions */}
					<div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
						<Link
							href="/fomiqsign"
							className="card hover:scale-105 transition-transform cursor-pointer"
						>
							<div className="text-center">
								<div className="w-12 h-12 bg-blue-500/20 rounded-lg flex items-center justify-center mx-auto mb-3">
									<svg
										className="w-6 h-6 text-blue-400"
										fill="none"
										stroke="currentColor"
										viewBox="0 0 24 24"
									>
										<path
											strokeLinecap="round"
											strokeLinejoin="round"
											strokeWidth={2}
											d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
										/>
									</svg>
								</div>
								<h3 className="text-lg font-semibold text-white mb-1">Sign Document</h3>
								<p className="text-gray-400 text-sm">Create and sign documents securely</p>
							</div>
						</Link>

						<Link
							href="/subscription"
							className="card hover:scale-105 transition-transform cursor-pointer"
						>
							<div className="text-center">
								<div className="w-12 h-12 bg-green-500/20 rounded-lg flex items-center justify-center mx-auto mb-3">
									<svg
										className="w-6 h-6 text-green-400"
										fill="none"
										stroke="currentColor"
										viewBox="0 0 24 24"
									>
										<path
											strokeLinecap="round"
											strokeLinejoin="round"
											strokeWidth={2}
											d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
										/>
									</svg>
								</div>
								<h3 className="text-lg font-semibold text-white mb-1">Manage Plans</h3>
								<p className="text-gray-400 text-sm">View and update your subscription</p>
							</div>
						</Link>

						<div className="card">
							<div className="text-center">
								<div className="w-12 h-12 bg-purple-500/20 rounded-lg flex items-center justify-center mx-auto mb-3">
									<svg
										className="w-6 h-6 text-purple-400"
										fill="none"
										stroke="currentColor"
										viewBox="0 0 24 24"
									>
										<path
											strokeLinecap="round"
											strokeLinejoin="round"
											strokeWidth={2}
											d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
										/>
									</svg>
								</div>
								<h3 className="text-lg font-semibold text-white mb-1">Profile</h3>
								<p className="text-gray-400 text-sm">Update your account information</p>
							</div>
						</div>
					</div>

					{/* User Info Card */}
					<div className="card">
						<h2 className="text-xl font-semibold text-white mb-4">Account Information</h2>
						<div className="grid md:grid-cols-2 gap-4">
							<div>
								<label className="block text-sm font-medium text-gray-400 mb-1">Full Name</label>
								<p className="text-white">
									{user?.firstName} {user?.lastName}
								</p>
							</div>
							<div>
								<label className="block text-sm font-medium text-gray-400 mb-1">Email</label>
								<p className="text-white">{user?.email}</p>
							</div>
							<div>
								<label className="block text-sm font-medium text-gray-400 mb-1">Phone</label>
								<p className="text-white">{user?.phoneNumber || "Not provided"}</p>
							</div>
							<div>
								<label className="block text-sm font-medium text-gray-400 mb-1">Company</label>
								<p className="text-white">{user?.company || "Not provided"}</p>
							</div>
							<div>
								<label className="block text-sm font-medium text-gray-400 mb-1">Member Since</label>
								<p className="text-white">
									{user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : "Unknown"}
								</p>
							</div>
							<div>
								<label className="block text-sm font-medium text-gray-400 mb-1">Last Login</label>
								<p className="text-white">
									{user?.updatedAt ? new Date(user.updatedAt).toLocaleDateString() : "Unknown"}
								</p>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
