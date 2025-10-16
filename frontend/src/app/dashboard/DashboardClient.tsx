"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/authStore";
import { Portal } from "@/components/Portal";
import { Activity } from "@/types/activity";

interface UserStats {
	totalDocuments: number;
	pendingSignatures: number;
	completedSignatures: number;
	subscriptionStatus: string;
	owner?: { total: number; pending: number; completed: number };
	assigned?: { total: number; pending: number; completed: number };
}

type FreeUsage = {
	hasActiveSubscription?: boolean;
	uploads?: { used: number; limit: number };
	signs?: { used: number; limit: number };
};

interface SubscriptionData {
	_id: string;
	planId: {
		_id: string;
		name: string;
		description: string;
		price: number;
		currency: string;
		interval: "month" | "year";
		features: string[];
	};
	status: string;
	currentPeriodStart?: Date;
	currentPeriodEnd?: Date;
	cancelAtPeriodEnd?: boolean;
}

// Phase 1 & 2 Optimization: Add interface for inbox items
interface InboxItem {
	id: string;
	name: string;
	status: string;
	createdAt?: string;
	updatedAt?: string;
	finalPdfUrl?: string;
	sender?: string;
	message?: {
		subject?: string;
		body?: string;
	};
	myRecipientInfo?: {
		signatureStatus?: string;
		signedAt?: string;
	};
}

export default function DashboardClient() {
	const user = useAuthStore((state) => state.user);
	const isLoading = useAuthStore((state) => state.isLoading);
	const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
	const router = useRouter();
	const [stats, setStats] = useState<UserStats | null>({
		totalDocuments: 0,
		pendingSignatures: 0,
		completedSignatures: 0,
		subscriptionStatus: "Loading...",
	});
	const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
	const [showCancelModal, setShowCancelModal] = useState(false);
	const [cancelling, setCancelling] = useState(false);
	const [confirmImmediate, setConfirmImmediate] = useState(false);
	const [loading, setLoading] = useState(true);
	const [usage, setUsage] = useState<FreeUsage | null>(null);

	// Phase 1 & 2 Optimization: Add inbox state with pagination
	const [inbox, setInbox] = useState<InboxItem[]>([]);
	const [inboxPage, setInboxPage] = useState(1);
	const [inboxTotal, setInboxTotal] = useState(0);
	const [inboxPages, setInboxPages] = useState(0);
	const INBOX_LIMIT = 10;

	// Auth guard - redirect to login if not authenticated
	useEffect(() => {
		if (!isLoading && !isAuthenticated) {
			router.replace("/login");
		}
	}, [isAuthenticated, isLoading, router]);

	// Phase 1 Optimization: Reuse server-prefetched activities (remove duplicate fetch)
	const { data: activitiesData } = useQuery({
		queryKey: ["activities"],
		enabled: false, // Don't refetch - use hydrated cache from server
		gcTime: 5 * 60 * 1000, // Cache for 5 minutes
	});

	// Phase 1 Optimization: Parallelize API calls with Promise.all
	const loadDashboardData = useCallback(async (pageNum: number = 1) => {
		try {
			// Fetch all data in parallel
			const [statsRes, inboxRes, subscriptionRes] = await Promise.all([
				fetch("/api/dashboard/stats", { credentials: "include" }),
				fetch(`/api/dashboard/inbox?page=${pageNum}&limit=${INBOX_LIMIT}`, {
					credentials: "include",
				}),
				fetch("/api/subscription/me", { credentials: "include" }),
			]);

			// Process stats response
			if (statsRes.ok) {
				const json = await statsRes.json();
				if (json?.success && json?.data) {
					setStats({
						totalDocuments: json.data.owner?.total || 0,
						pendingSignatures: json.data.assigned?.pending || 0,
						completedSignatures: json.data.assigned?.completed || 0,
						subscriptionStatus: "Free Plan",
						owner: json.data.owner,
						assigned: json.data.assigned,
					});
					if (json.data.usage) {
						setUsage(json.data.usage as FreeUsage);
					}
				}
			}

			// Process inbox response
			if (inboxRes.ok) {
				const json = await inboxRes.json();
				if (json?.success && Array.isArray(json.data)) {
					setInbox(json.data);
					if (json.pagination) {
						setInboxPage(json.pagination.current);
						setInboxTotal(json.pagination.total);
						setInboxPages(json.pagination.pages);
					}
				}
			}

			// Process subscription response
			if (subscriptionRes.ok) {
				const subscriptionData = await subscriptionRes.json();
				if (subscriptionData?.subscription) {
					setSubscription(subscriptionData.subscription);
					// Update stats subscription status
					setStats((prev) => ({
						...prev!,
						subscriptionStatus: subscriptionData.subscription?.planId?.name || "Free Plan",
					}));
				}
			}
		} catch (error) {
			console.error("Failed to load dashboard data:", error);
			setStats({
				totalDocuments: 0,
				pendingSignatures: 0,
				completedSignatures: 0,
				subscriptionStatus: "Free Plan",
			});
		} finally {
			setLoading(false);
		}
	}, []);

	// Phase 1 Optimization: Single useEffect that calls parallel loader
	useEffect(() => {
		loadDashboardData();
	}, [loadDashboardData]);

	// Helper to convert backend path to absolute URL
	const getAbsolutePdfUrl = (pdfPath: string | undefined) => {
		if (!pdfPath) return "";
		if (pdfPath.startsWith("http://") || pdfPath.startsWith("https://")) return pdfPath;

		// Backend is at localhost:5000, paths like /uploads/... need http://localhost:5000/api
		const backendBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";
		const baseWithoutApi = backendBase.replace(/\/api$/, "");
		const cleanPath = pdfPath.startsWith("/") ? pdfPath : `/${pdfPath}`;

		// PDF files are served from /api/uploads, not /uploads
		if (cleanPath.startsWith("/uploads/")) {
			return `${baseWithoutApi}/api${cleanPath}`;
		}
		return `${baseWithoutApi}${cleanPath}`;
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

				{/* Free plan usage banner (shows when there is no active subscription) */}
				{usage && usage.hasActiveSubscription === false && (
					<div className="mb-8 rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-4 py-3 text-yellow-200">
						<div className="flex items-start justify-between gap-4">
							<div>
								<p className="font-medium">You are on the Free plan</p>
								<p className="text-sm mt-1">
									Uploads: {usage.uploads?.used ?? 0} of {usage.uploads?.limit ?? 1} used • Signing:{" "}
									{usage.signs?.used ?? 0} of {usage.signs?.limit ?? 1} used
								</p>
							</div>
							<Link
								href="/subscription"
								className="shrink-0 text-xs font-medium underline hover:opacity-90"
							>
								See plans
							</Link>
						</div>
					</div>
				)}

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

				{/* Subscription Details */}
				{/* My Documents (owner) summary - moved outside inbox items */}
				{stats?.owner && (
					<div className="card p-6 mb-8">
						<h3 className="text-lg font-semibold text-white mb-3">My documents (owned by me)</h3>
						<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
							<div className="bg-gray-800/30 rounded-lg p-4">
								<p className="text-gray-400 text-sm mb-1">Owned Total</p>
								<p className="text-white font-semibold text-xl">{stats.owner.total}</p>
							</div>
							<div className="bg-gray-800/30 rounded-lg p-4">
								<p className="text-gray-400 text-sm mb-1">Owned Pending</p>
								<p className="text-yellow-300 font-semibold text-xl">{stats.owner.pending}</p>
							</div>
							<div className="bg-gray-800/30 rounded-lg p-4">
								<p className="text-gray-400 text-sm mb-1">Owned Completed</p>
								<p className="text-green-300 font-semibold text-xl">{stats.owner.completed}</p>
							</div>
						</div>
						<p className="text-xs text-gray-500 mt-2">
							These counts are based on documents you created (not archived).
						</p>
					</div>
				)}

				{/* Inbox: Documents assigned to the user */}
				<div className="card p-6 mb-8">
					<div className="flex items-center justify-between mb-3">
						<h3 className="text-lg font-semibold text-white">Documents assigned to you</h3>
						{stats?.assigned && (
							<div className="text-xs text-gray-400">
								Total: <span className="text-white font-medium">{stats.assigned.total}</span> •
								Pending:{" "}
								<span className="text-yellow-300 font-medium">{stats.assigned.pending}</span> •
								Completed:{" "}
								<span className="text-green-300 font-medium">{stats.assigned.completed}</span>
							</div>
						)}
					</div>
					{inbox && inbox.length > 0 ? (
						<>
							<ul className="space-y-3">
								{inbox.map((item) => (
									<li
										key={item.id}
										className="flex items-center justify-between p-4 bg-gray-800/30 rounded-lg hover:bg-gray-800/50 transition-colors"
									>
										<div className="flex-1">
											<div className="font-medium text-white">{item.name}</div>
											<div className="flex items-center gap-3 mt-1">
												<div className="text-xs text-gray-400">
													Status:{" "}
													<span
														className={
															item.status === "final"
																? "text-green-400"
																: item.status === "active"
																? "text-yellow-400"
																: "text-blue-400"
														}
													>
														{item.status}
													</span>
												</div>

												{item.sender && (
													<div className="text-xs text-gray-400">From: {item.sender}</div>
												)}
												{item.myRecipientInfo?.signatureStatus && (
													<div className="text-xs text-gray-400">
														Your status:{" "}
														<span
															className={
																item.myRecipientInfo.signatureStatus === "signed"
																	? "text-green-400"
																	: "text-yellow-400"
															}
														>
															{item.myRecipientInfo.signatureStatus}
														</span>
													</div>
												)}
											</div>
											{item.message?.subject && (
												<div className="text-xs text-gray-400 mt-1">📧 {item.message.subject}</div>
											)}
										</div>
										<div className="flex gap-2">
											{item.finalPdfUrl && (
												<a
													href={getAbsolutePdfUrl(item.finalPdfUrl)}
													target="_blank"
													rel="noreferrer"
													className="px-3 py-1 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors"
												>
													View PDF
												</a>
											)}
											{item.myRecipientInfo?.signatureStatus !== "signed" ? (
												<Link
													href={`/fomiqsign/sign/${item.id}`}
													className="px-3 py-1 text-sm bg-green-600 hover:bg-green-700 text-white rounded-md transition-colors"
												>
													Sign Document
												</Link>
											) : (
												<div className="px-3 py-1 text-sm bg-gray-600 text-white rounded-md cursor-not-allowed opacity-50">
													✅ Signed
												</div>
											)}
										</div>
									</li>
								))}
							</ul>

							{/* Phase 2 Optimization: Add pagination controls */}
							{inboxPages > 1 && (
								<div className="flex items-center justify-between mt-6 pt-6 border-t border-gray-700">
									<div className="text-sm text-gray-400">
										Showing {(inboxPage - 1) * INBOX_LIMIT + 1} to{" "}
										{Math.min(inboxPage * INBOX_LIMIT, inboxTotal)} of {inboxTotal} documents
									</div>
									<div className="flex gap-2">
										<button
											onClick={() => loadDashboardData(Math.max(1, inboxPage - 1))}
											disabled={inboxPage === 1}
											className="px-3 py-1 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-md text-sm transition-colors"
										>
											Previous
										</button>
										<div className="flex items-center gap-1">
											{Array.from({ length: Math.min(5, inboxPages) }, (_, i) => {
												const pageNum = i + 1;
												return (
													<button
														key={pageNum}
														onClick={() => loadDashboardData(pageNum)}
														className={`px-3 py-1 rounded-md text-sm transition-colors ${
															inboxPage === pageNum
																? "bg-blue-600 text-white"
																: "bg-gray-700 hover:bg-gray-600 text-white"
														}`}
													>
														{pageNum}
													</button>
												);
											})}
										</div>
										<button
											onClick={() => loadDashboardData(Math.min(inboxPages, inboxPage + 1))}
											disabled={inboxPage === inboxPages}
											className="px-3 py-1 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-md text-sm transition-colors"
										>
											Next
										</button>
									</div>
								</div>
							)}
						</>
					) : (
						<div className="text-center py-8">
							<div className="text-gray-400 mb-2">
								<svg
									className="w-16 h-16 mx-auto mb-4 text-gray-600"
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24"
								>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={1.5}
										d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
									/>
								</svg>
								<p className="text-lg">No documents assigned to you</p>
								<p className="text-sm mt-2">
									Documents that require your signature will appear here
								</p>
							</div>
						</div>
					)}
				</div>

				{/* Subscription Details */}
				{subscription && (
					<div className="card p-6 mb-8">
						<div className="flex items-center justify-between mb-4">
							<h3 className="text-xl font-semibold text-white">Current Subscription</h3>
							<Link
								href="/subscription"
								className="text-blue-400 hover:text-blue-300 text-sm font-medium"
							>
								Manage →
							</Link>
						</div>
						<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
							<div className="bg-gray-800/30 rounded-lg p-4">
								<p className="text-gray-400 text-sm mb-1">Plan</p>
								<p className="text-white font-semibold">{subscription.planId.name}</p>
							</div>
							<div className="bg-gray-800/30 rounded-lg p-4">
								<p className="text-gray-400 text-sm mb-1">Billing</p>
								<p className="text-white font-semibold">
									${subscription.planId.price}/{subscription.planId.interval}
								</p>
							</div>
							<div className="bg-gray-800/30 rounded-lg p-4">
								<p className="text-gray-400 text-sm mb-1">Status</p>
								<p
									className={`font-semibold ${
										subscription.status === "active"
											? "text-green-400"
											: subscription.status === "canceled"
											? "text-red-400"
											: "text-yellow-400"
									}`}
								>
									{subscription.status.charAt(0).toUpperCase() + subscription.status.slice(1)}
								</p>
							</div>
							{subscription.currentPeriodEnd && (
								<div className="bg-gray-800/30 rounded-lg p-4 md:col-span-2 lg:col-span-3">
									<p className="text-gray-400 text-sm mb-1">Next Billing Date</p>
									<p className="text-white font-semibold">
										{new Date(subscription.currentPeriodEnd).toLocaleDateString()}
									</p>
								</div>
							)}
						</div>
						{subscription.cancelAtPeriodEnd && (
							<div className="mt-4 p-3 bg-yellow-500/20 border border-yellow-500/30 rounded-lg">
								<p className="text-yellow-400 text-sm">
									Your subscription will be canceled at the end of the current billing period.
								</p>
							</div>
						)}

						{/* Cancel button */}
						<div className="mt-4">
							<button
								className="px-4 py-2 bg-red-600 text-white rounded-md"
								onClick={() => setShowCancelModal(true)}
							>
								Cancel subscription
							</button>
						</div>
					</div>
				)}

				{/* Quick Actions */}
				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
					<Link
						href="/fomiqsign/dashboard"
						className="card p-6 hover:bg-gray-800/50 transition-colors group"
					>
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

					<Link href="/profile" className="card p-6 hover:bg-gray-800/50 transition-colors group">
						<div className="flex items-center mb-4">
							<div className="p-3 bg-orange-500/20 rounded-lg group-hover:bg-orange-500/30 transition-colors">
								<svg
									className="w-8 h-8 text-orange-400"
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
							<div className="ml-4">
								<h3 className="text-lg font-semibold text-white">Edit Profile</h3>
								<p className="text-gray-400 text-sm">Update your personal information</p>
							</div>
						</div>
						<div className="text-orange-400 text-sm font-medium">Edit →</div>
					</Link>
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

			{/* Global Cancel Modal (overlays whole page) */}
			{showCancelModal && (
				<Portal>
					<div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50">
						<div className="bg-white dark:bg-slate-800 rounded-lg p-6 max-w-md w-full shadow-2xl">
							<h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
								Cancel subscription
							</h3>
							<p className="text-sm text-slate-700 dark:text-slate-300 mb-4">
								Choose how you&apos;d like to cancel. &quot;At period end&quot; will keep access
								until your next billing date. &quot;Immediate&quot; will stop access now and may
								require refunds per policy.
							</p>
							<div className="space-y-3">
								{confirmImmediate && (
									<p className="text-sm text-red-500">Confirm immediate cancellation?</p>
								)}
								<div className="flex gap-2 justify-end flex-wrap">
									<button
										className="px-4 py-2 bg-yellow-500 text-black rounded-md"
										onClick={async () => {
											setCancelling(true);
											try {
												const res = await fetch("/api/subscription/cancel", {
													method: "POST",
													headers: { "Content-Type": "application/json" },
													credentials: "include",
													body: JSON.stringify({ mode: "at_period_end" }),
												});
												if (res.ok) {
													setShowCancelModal(false);
													const refreshed = await fetch("/api/subscription/me", {
														credentials: "include",
													});
													if (refreshed.ok) {
														const json = await refreshed.json();
														setSubscription(json.subscription);
													}
												}
											} catch (err) {
												console.error("Failed to cancel subscription (at period end):", err);
												alert("Failed to cancel subscription. Try again or contact support.");
											} finally {
												setCancelling(false);
											}
										}}
									>
										Cancel at period end
									</button>
									{!confirmImmediate ? (
										<button
											className="px-4 py-2 bg-red-600 text-white rounded-md"
											onClick={() => setConfirmImmediate(true)}
										>
											Cancel immediately
										</button>
									) : (
										<>
											<button
												className="px-3 py-2 bg-red-700 text-white rounded-md"
												onClick={async () => {
													setCancelling(true);
													try {
														const res = await fetch("/api/subscription/cancel", {
															method: "POST",
															headers: { "Content-Type": "application/json" },
															credentials: "include",
															body: JSON.stringify({ mode: "immediate" }),
														});
														if (res.ok) {
															setShowCancelModal(false);
															setConfirmImmediate(false);
															const refreshed = await fetch("/api/subscription/me", {
																credentials: "include",
															});
															if (refreshed.ok) {
																const json = await refreshed.json();
																setSubscription(json.subscription);
															}
														}
													} catch (err) {
														console.error("Failed to cancel subscription immediately:", err);
														alert("Failed to cancel subscription. Try again or contact support.");
													} finally {
														setCancelling(false);
													}
												}}
											>
												Yes, cancel now
											</button>
											<button
												className="px-3 py-2 bg-gray-200 text-black rounded-md"
												onClick={() => setConfirmImmediate(false)}
											>
												No, go back
											</button>
										</>
									)}
									<button
										className="px-4 py-2 bg-gray-200 text-black rounded-md"
										onClick={() => {
											setShowCancelModal(false);
											setConfirmImmediate(false);
										}}
										disabled={cancelling}
									>
										Close
									</button>
								</div>
							</div>
						</div>
					</div>
				</Portal>
			)}
		</div>
	);
}
