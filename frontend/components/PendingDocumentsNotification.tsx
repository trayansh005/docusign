"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useAuthStore } from "@/stores/authStore";
import { useState, useRef, useEffect } from "react";
import apiClient from "@/lib/apiClient";

interface PendingDocumentsNotificationProps {
	badgeOnly?: boolean;
}

interface InboxItem {
	id: string;
	name: string;
	status: string;
	createdAt?: string;
	updatedAt?: string;
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

export function PendingDocumentsNotification({
	badgeOnly = false,
}: PendingDocumentsNotificationProps) {
	const user = useAuthStore((state) => state.user);
	const [isOpen, setIsOpen] = useState(false);
	const dropdownRef = useRef<HTMLDivElement>(null);

	// Get pending count
	const { data: countData, refetch } = useQuery({
		queryKey: ["pendingDocumentsCount"],
		queryFn: async () => {
			const data = await apiClient.get<{ data: { pendingCount: number; unreadCount: number } }>(
				"/dashboard/pending-count"
			);
			return data.data;
		},
		enabled: !!user,
		refetchInterval: 60000,
	});

	// Get inbox items when dropdown is open
	const { data: inboxData, isLoading } = useQuery({
		queryKey: ["pendingDocumentsList"],
		queryFn: async () => {
			const data = await apiClient.get<{ data: InboxItem[] }>("/dashboard/inbox?page=1&limit=5");
			return data.data;
		},
		enabled: !!user && isOpen,
	});

	const pendingCount = countData?.pendingCount || 0;
	const unreadCount = countData?.unreadCount || 0;

	// Mark notifications as read when dropdown opens
	useEffect(() => {
		if (isOpen && unreadCount > 0) {
			apiClient
				.post("/dashboard/mark-notifications-read")
				.then(() => refetch())
				.catch(console.error);
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [isOpen, unreadCount]);

	// Close dropdown when clicking outside
	useEffect(() => {
		function handleClickOutside(event: MouseEvent) {
			if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
				setIsOpen(false);
			}
		}

		if (isOpen) {
			document.addEventListener("mousedown", handleClickOutside);
			return () => document.removeEventListener("mousedown", handleClickOutside);
		}
	}, [isOpen]);

	if (!user) {
		return null;
	}

	// Badge only version (for use inside other links)
	if (badgeOnly) {
		if (unreadCount === 0) return null;
		return (
			<span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-xs font-bold text-white bg-red-600 rounded-full">
				{unreadCount > 99 ? "99+" : unreadCount}
			</span>
		);
	}

	// Full version with dropdown
	return (
		<div className="relative" ref={dropdownRef}>
			<button
				onClick={() => setIsOpen(!isOpen)}
				className="relative inline-flex items-center justify-center p-2 rounded-lg hover:bg-gray-800/50 transition-all duration-200 hover:scale-105"
				title={
					unreadCount > 0
						? `You have ${unreadCount} new document${
								unreadCount > 1 ? "s" : ""
						  } waiting for your signature`
						: `${pendingCount} pending document${pendingCount !== 1 ? "s" : ""}`
				}
			>
				{/* Bell Icon with animation */}
				<svg
					className={`w-6 h-6 transition-all duration-300 ${
						unreadCount > 0 ? "text-yellow-400 animate-pulse" : "text-gray-400"
					}`}
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24"
					xmlns="http://www.w3.org/2000/svg"
				>
					<path
						strokeLinecap="round"
						strokeLinejoin="round"
						strokeWidth={2}
						d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
					/>
				</svg>

				{/* Badge with unread count - only show if > 0 */}
				{unreadCount > 0 && (
					<span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[20px] h-5 px-1.5 text-xs font-bold text-white bg-gradient-to-r from-red-600 to-red-500 rounded-full border-2 border-gray-900 shadow-lg animate-bounce">
						{unreadCount > 99 ? "99+" : unreadCount}
					</span>
				)}
			</button>

			{/* Dropdown Panel with animation */}
			{isOpen && (
				<div className="absolute right-0 mt-2 w-96 bg-gradient-to-b from-gray-900 to-gray-950 border border-gray-700/50 rounded-xl shadow-2xl z-50 max-h-[500px] overflow-hidden flex flex-col animate-in fade-in slide-in-from-top-2 duration-200 backdrop-blur-sm">
					{/* Header with gradient */}
					<div className="px-5 py-4 border-b border-gray-700/50 flex items-center justify-between bg-gradient-to-r from-gray-800/50 to-gray-900/50">
						<div className="flex items-center gap-2">
							{pendingCount > 0 ? (
								<>
									<div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse"></div>
									<h3 className="text-white font-semibold text-base">Pending Documents</h3>
									<span className="px-2 py-0.5 text-xs font-bold text-white bg-blue-600 rounded-full">
										{pendingCount}
									</span>
								</>
							) : (
								<>
									<div className="w-2 h-2 bg-green-400 rounded-full"></div>
									<h5 className="text-white font-semibold text-base">All Caught Up!</h5>
								</>
							)}
						</div>
						<Link
							href="/dashboard"
							className="text-blue-400 hover:text-blue-300 text-sm font-medium transition-colors hover:underline"
							onClick={() => setIsOpen(false)}
						>
							View All
						</Link>
					</div>

					{/* Content with improved styling */}
					<div className="overflow-y-auto flex-1 scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-gray-900">
						{isLoading ? (
							<div className="flex flex-col items-center justify-center py-12">
								<div className="animate-spin rounded-full h-10 w-10 border-3 border-blue-500 border-t-transparent"></div>
								<p className="text-gray-400 text-sm mt-3">Loading documents...</p>
							</div>
						) : inboxData && inboxData.length > 0 ? (
							<div className="divide-y divide-gray-700/30">
								{inboxData.map((item, index) => (
									<Link
										key={item.id}
										href={`/fomiqsign/sign/${item.id}`}
										className="block px-5 py-4 hover:bg-gradient-to-r hover:from-gray-800/60 hover:to-gray-800/30 transition-all duration-200 group"
										onClick={() => setIsOpen(false)}
										style={{ animationDelay: `${index * 50}ms` }}
									>
										<div className="flex items-start justify-between gap-3">
											<div className="flex-1 min-w-0">
												{/* Document icon and name */}
												<div className="flex items-center gap-2 mb-2">
													<svg
														className="w-5 h-5 text-blue-400 flex-shrink-0"
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
													<p className="text-white font-medium truncate group-hover:text-blue-300 transition-colors">
														{item.name}
													</p>
												</div>

												{/* Sender info */}
												{item.sender && (
													<div className="flex items-center gap-1.5 text-gray-400 text-xs mb-1">
														<svg
															className="w-3.5 h-3.5"
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
														<span>From: {item.sender}</span>
													</div>
												)}

												{/* Message subject */}
												{item.message?.subject && (
													<div className="flex items-center gap-1.5 text-gray-400 text-xs mb-2 truncate">
														<svg
															className="w-3.5 h-3.5 flex-shrink-0"
															fill="none"
															stroke="currentColor"
															viewBox="0 0 24 24"
														>
															<path
																strokeLinecap="round"
																strokeLinejoin="round"
																strokeWidth={2}
																d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
															/>
														</svg>
														<span className="truncate">{item.message.subject}</span>
													</div>
												)}

												{/* Status badges */}
												<div className="flex items-center gap-2 mt-2">
													<span
														className={`text-xs px-2.5 py-1 rounded-full font-medium ${
															item.status === "final"
																? "bg-green-500/20 text-green-400 border border-green-500/30"
																: item.status === "active"
																? "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30"
																: "bg-blue-500/20 text-blue-400 border border-blue-500/30"
														}`}
													>
														{item.status}
													</span>
													{item.myRecipientInfo?.signatureStatus && (
														<span
															className={`text-xs px-2.5 py-1 rounded-full font-medium ${
																item.myRecipientInfo.signatureStatus === "signed"
																	? "bg-green-500/20 text-green-400 border border-green-500/30"
																	: "bg-orange-500/20 text-orange-400 border border-orange-500/30"
															}`}
														>
															{item.myRecipientInfo.signatureStatus === "signed"
																? "✓ Signed"
																: "⏳ Pending"}
														</span>
													)}
												</div>
											</div>

											{/* Arrow icon */}
											<svg
												className="w-5 h-5 text-gray-500 flex-shrink-0 mt-1 group-hover:text-blue-400 group-hover:translate-x-1 transition-all"
												fill="none"
												stroke="currentColor"
												viewBox="0 0 24 24"
											>
												<path
													strokeLinecap="round"
													strokeLinejoin="round"
													strokeWidth={2}
													d="M9 5l7 7-7 7"
												/>
											</svg>
										</div>
									</Link>
								))}
							</div>
						) : (
							<div className="flex flex-col items-center justify-center py-12 px-4">
								<div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mb-3">
									<svg
										className="w-8 h-8 text-gray-600"
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
								<p className="text-gray-400 text-sm font-medium">No pending documents</p>
								<p className="text-gray-500 text-xs mt-1">You&apos;re all caught up!</p>
							</div>
						)}
					</div>

					{/* Footer with improved styling */}
					{inboxData && inboxData.length > 0 && (
						<div className="px-5 py-3 border-t border-gray-700/50 bg-gradient-to-r from-gray-800/30 to-gray-900/30">
							<Link
								href="/dashboard"
								className="flex items-center justify-center gap-2 text-blue-400 hover:text-blue-300 text-sm font-medium transition-all hover:gap-3 group"
								onClick={() => setIsOpen(false)}
							>
								<span>View All Documents</span>
								<svg
									className="w-4 h-4 group-hover:translate-x-1 transition-transform"
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24"
								>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={2}
										d="M13 7l5 5m0 0l-5 5m5-5H6"
									/>
								</svg>
							</Link>
						</div>
					)}
				</div>
			)}
		</div>
	);
}
