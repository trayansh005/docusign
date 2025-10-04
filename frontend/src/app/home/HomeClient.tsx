"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { getRecentActivities } from "@/services/activityAPI";
import { Activity } from "@/types/activity";

interface UserStats {
	totalDocuments: number;
	pendingSignatures: number;
	completedSignatures: number;
	subscriptionStatus: string;
}

export default function HomeClient() {
	const { user } = useAuth();
	const [stats, setStats] = useState<UserStats | null>(null);
	const [loading, setLoading] = useState(true);

	// Fetch activities using React Query
	const { data: activitiesData } = useQuery({
		queryKey: ["activities"],
		queryFn: getRecentActivities,
	});

	useEffect(() => {
		loadUserStats();
	}, []);

	const loadUserStats = async () => {
		try {
			const token = localStorage.getItem("token");
			if (!token) return;

			// This would typically fetch from your API
			// For now, we'll use mock data
			setStats({
				totalDocuments: 12,
				pendingSignatures: 3,
				completedSignatures: 9,
				subscriptionStatus: "Active",
			});
		} catch (error) {
			console.error("Failed to load user stats:", error);
		} finally {
			setLoading(false);
		}
	};

	// Extract activities from API response
	let activities: Activity[] = [];
	if (activitiesData && typeof activitiesData === "object") {
		const g = activitiesData as unknown as Record<string, unknown>;
		if (Array.isArray(g.activities)) activities = g.activities as unknown as Activity[];
	}

	const formatTimeAgo = (dateString: string) => {
		const now = new Date();
		const date = new Date(dateString);
		const diffInMs = now.getTime() - date.getTime();
		const diffInHours = diffInMs / (1000 * 60 * 60);
		const diffInDays = diffInHours / 24;

		if (diffInHours < 1) {
			return "Less than an hour ago";
		} else if (diffInHours < 24) {
			return `${Math.floor(diffInHours)} hour${Math.floor(diffInHours) > 1 ? "s" : ""} ago`;
		} else {
			return `${Math.floor(diffInDays)} day${Math.floor(diffInDays) > 1 ? "s" : ""} ago`;
		}
	};

	const getActivityColor = (type: string) => {
		switch (type.toLowerCase()) {
			case "document_signed":
			case "signature_completed":
				return "bg-green-400";
			case "document_sent":
			case "new_document":
				return "bg-blue-400";
			case "subscription":
			case "payment":
				return "bg-yellow-400";
			default:
				return "bg-gray-400";
		}
	};

	if (loading) {
		return (
			<div className="min-h-screen flex items-center justify-center">
				<div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500"></div>
			</div>
		);
	}

	return (
		<div className="min-h-screen py-8 px-4 sm:px-6 lg:px-8">
			<div className="max-w-7xl mx-auto">
				{/* Welcome Section */}
				<div className="mb-8">
					<h1 className="text-3xl font-bold text-white mb-2">
						Welcome back, {user?.firstName || "User"}!
					</h1>
					<p className="text-gray-400">
						Manage your documents and subscriptions from your dashboard.
					</p>
				</div>

				{/* Stats Cards */}
				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
					<div className="card p-6">
						<div className="flex items-center">
							<div className="p-2 bg-blue-500/20 rounded-lg">
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
							<div className="ml-4">
								<p className="text-sm font-medium text-gray-400">Total Documents</p>
								<p className="text-2xl font-bold text-white">{stats?.totalDocuments || 0}</p>
							</div>
						</div>
					</div>

					<div className="card p-6">
						<div className="flex items-center">
							<div className="p-2 bg-yellow-500/20 rounded-lg">
								<svg
									className="w-6 h-6 text-yellow-400"
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24"
								>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={2}
										d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
									/>
								</svg>
							</div>
							<div className="ml-4">
								<p className="text-sm font-medium text-gray-400">Pending Signatures</p>
								<p className="text-2xl font-bold text-white">{stats?.pendingSignatures || 0}</p>
							</div>
						</div>
					</div>

					<div className="card p-6">
						<div className="flex items-center">
							<div className="p-2 bg-green-500/20 rounded-lg">
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
							<div className="ml-4">
								<p className="text-sm font-medium text-gray-400">Completed</p>
								<p className="text-2xl font-bold text-white">{stats?.completedSignatures || 0}</p>
							</div>
						</div>
					</div>

					<div className="card p-6">
						<div className="flex items-center">
							<div className="p-2 bg-purple-500/20 rounded-lg">
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
										d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
									/>
								</svg>
							</div>
							<div className="ml-4">
								<p className="text-sm font-medium text-gray-400">Subscription</p>
								<p className="text-2xl font-bold text-white">
									{stats?.subscriptionStatus || "N/A"}
								</p>
							</div>
						</div>
					</div>
				</div>

				{/* Quick Actions */}
				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
					<Link href="/fomiqsign" className="card p-6 hover:bg-gray-800/50 transition-colors group">
						<div className="flex items-center mb-4">
							<div className="p-3 bg-blue-500/20 rounded-lg group-hover:bg-blue-500/30 transition-colors">
								<svg
									className="w-8 h-8 text-blue-400"
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24"
								>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={2}
										d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
									/>
								</svg>
							</div>
							<div className="ml-4">
								<h3 className="text-lg font-semibold text-white">Sign Document</h3>
								<p className="text-gray-400 text-sm">Create and send documents for signature</p>
							</div>
						</div>
						<div className="text-blue-400 text-sm font-medium">Get started →</div>
					</Link>

					<Link
						href="/subscription"
						className="card p-6 hover:bg-gray-800/50 transition-colors group"
					>
						<div className="flex items-center mb-4">
							<div className="p-3 bg-green-500/20 rounded-lg group-hover:bg-green-500/30 transition-colors">
								<svg
									className="w-8 h-8 text-green-400"
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
							<div className="ml-4">
								<h3 className="text-lg font-semibold text-white">Manage Subscription</h3>
								<p className="text-gray-400 text-sm">View and update your subscription plans</p>
							</div>
						</div>
						<div className="text-green-400 text-sm font-medium">Manage →</div>
					</Link>

					<div className="card p-6">
						<div className="flex items-center mb-4">
							<div className="p-3 bg-purple-500/20 rounded-lg">
								<svg
									className="w-8 h-8 text-purple-400"
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24"
								>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={2}
										d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
									/>
								</svg>
							</div>
							<div className="ml-4">
								<h3 className="text-lg font-semibold text-white">Analytics</h3>
								<p className="text-gray-400 text-sm">View your document signing analytics</p>
							</div>
						</div>
						<div className="text-gray-500 text-sm">Coming soon</div>
					</div>
				</div>

				{/* Recent Activity */}
				<div className="card p-6">
					<h3 className="text-xl font-semibold text-white mb-4">Recent Activity</h3>
					<div className="space-y-4">
						{activities.length > 0 ? (
							activities.map((activity) => (
								<div key={activity._id} className="flex items-center p-4 bg-gray-800/30 rounded-lg">
									<div
										className={`w-2 h-2 ${getActivityColor(activity.type)} rounded-full mr-4`}
									></div>
									<div className="flex-1">
										<p className="text-white text-sm">{activity.message}</p>
										<p className="text-gray-400 text-xs">{formatTimeAgo(activity.createdAt)}</p>
									</div>
								</div>
							))
						) : (
							<div className="text-center py-8">
								<p className="text-gray-400">No recent activity</p>
							</div>
						)}
					</div>
				</div>
			</div>
		</div>
	);
}
