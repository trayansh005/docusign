"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
	History,
	Upload,
	FileText,
	PenTool,
	CheckCircle,
	Trash2,
	Eye,
	MapPin,
	Clock,
	User,
	Search,
	Filter
} from "lucide-react";
import { getDocuSignActivities } from "@/services/activityAPI";

type ActivityType =
	| "DOCUSIGN_TEMPLATE_CREATED"
	| "DOCUSIGN_TEMPLATE_UPDATED"
	| "DOCUSIGN_TEMPLATE_DELETED"
	| "DOCUSIGN_TEMPLATE_SIGNED"
	| "DOCUSIGN_TEMPLATE_COMPLETED"
	| "DOCUSIGN_TEMPLATE_SENT"
	| "DOCUSIGN_TEMPLATE_ARCHIVED"
	| "DOCUSIGN_SIGNATURE_FIELD_DELETED";

const activityTypeConfig: Record<ActivityType, { icon: React.ComponentType<{ className?: string }>, color: string, label: string }> = {
	DOCUSIGN_TEMPLATE_CREATED: { icon: Upload, color: "text-green-500", label: "Template Created" },
	DOCUSIGN_TEMPLATE_UPDATED: { icon: FileText, color: "text-blue-500", label: "Template Updated" },
	DOCUSIGN_TEMPLATE_DELETED: { icon: Trash2, color: "text-red-500", label: "Template Deleted" },
	DOCUSIGN_TEMPLATE_SIGNED: { icon: PenTool, color: "text-purple-500", label: "Template Signed" },
	DOCUSIGN_TEMPLATE_COMPLETED: { icon: CheckCircle, color: "text-green-600", label: "Template Completed" },
	DOCUSIGN_TEMPLATE_SENT: { icon: Eye, color: "text-indigo-500", label: "Template Sent" },
	DOCUSIGN_TEMPLATE_ARCHIVED: { icon: History, color: "text-gray-500", label: "Template Archived" },
	DOCUSIGN_SIGNATURE_FIELD_DELETED: { icon: Trash2, color: "text-orange-500", label: "Field Deleted" },
};

interface ActivityLogsProps {
	className?: string;
}

export const ActivityLogs: React.FC<ActivityLogsProps> = ({ className = "" }) => {
	const [filters, setFilters] = useState({
		type: "all",
		search: "",
		page: 1,
		limit: 10,
	});

	const { data, isLoading, error } = useQuery({
		queryKey: ["docusign-activities", filters],
		queryFn: () => getDocuSignActivities({
			page: filters.page,
			limit: filters.limit,
			type: filters.type !== "all" ? filters.type : undefined,
			search: filters.search || undefined,
		}),
	});

	const getActivityIcon = (type: string) => {
		const config = activityTypeConfig[type as ActivityType];
		if (!config) return { icon: History, color: "text-gray-500" };
		return { icon: config.icon, color: config.color };
	};

	const formatDate = (dateString: string) => {
		const date = new Date(dateString);
		const now = new Date();
		const diffMs = now.getTime() - date.getTime();
		const diffMins = Math.floor(diffMs / (1000 * 60));
		const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
		const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

		if (diffMins < 1) return "Just now";
		if (diffMins < 60) return `${diffMins}m ago`;
		if (diffHours < 24) return `${diffHours}h ago`;
		if (diffDays < 7) return `${diffDays}d ago`;

		return date.toLocaleDateString("en-US", {
			month: "short",
			day: "numeric",
			year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
		});
	};

	const handleFilterChange = (key: string, value: string | number) => {
		setFilters(prev => ({
			...prev,
			[key]: value,
			...(key !== "page" && { page: 1 }) // Reset page when other filters change
		}));
	};

	if (isLoading) {
		return (
			<div className={`flex items-center justify-center py-8 ${className}`}>
				<div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
				<span className="ml-2 text-gray-200">Loading activities...</span>
			</div>
		);
	}

	if (error) {
		return (
			<div className={`text-center py-8 ${className}`}>
				<History className="mx-auto h-8 w-8 text-red-400 mb-2" />
				<h3 className="text-sm font-medium text-white mb-1">Failed to load activities</h3>
				<p className="text-xs text-gray-200">Please try again later</p>
			</div>
		);
	}

	return (
		<div className={`space-y-4 ${className}`}>
			{/* Compact Filters */}
			<div className="flex flex-col sm:flex-row gap-3">
				<div className="flex-1 relative">
					<Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-3 w-3 text-gray-400" />
					<input
						type="text"
						placeholder="Search activities..."
						value={filters.search}
						onChange={(e) => handleFilterChange("search", e.target.value)}
						className="w-full pl-9 pr-3 py-2 text-sm bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
					/>
				</div>
				<div className="sm:w-40">
					<select
						value={filters.type}
						onChange={(e) => handleFilterChange("type", e.target.value)}
						className="w-full px-3 py-2 text-sm bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
					>
						<option value="all">All Activities</option>
						<option value="DOCUSIGN_TEMPLATE_CREATED">Created</option>
						<option value="DOCUSIGN_TEMPLATE_UPDATED">Updated</option>
						<option value="DOCUSIGN_TEMPLATE_SIGNED">Signed</option>
						<option value="DOCUSIGN_TEMPLATE_COMPLETED">Completed</option>
						<option value="DOCUSIGN_TEMPLATE_SENT">Sent</option>
						<option value="DOCUSIGN_TEMPLATE_DELETED">Deleted</option>
					</select>
				</div>
			</div>

			{/* Activity List */}
			<div className="bg-gray-700/30 rounded-lg max-h-96 overflow-y-auto">
				{data?.data?.length === 0 ? (
					<div className="text-center py-8">
						<History className="mx-auto h-8 w-8 text-gray-300 mb-2" />
						<h3 className="text-sm font-medium text-white mb-1">No activities found</h3>
						<p className="text-xs text-gray-200">
							{filters.search || filters.type !== "all"
								? "Try adjusting your search or filters"
								: "DocuSign activities will appear here"
							}
						</p>
					</div>
				) : (
					<div className="divide-y divide-gray-600">
						{data?.data?.map((activity) => {
							const { icon: Icon, color } = getActivityIcon(activity.type);
							const details = activity.details as Record<string, unknown> || {};

							return (
								<div key={activity._id} className="p-4 hover:bg-gray-600/30 transition-colors">
									<div className="flex items-start gap-3">
										<div className={`flex-shrink-0 p-1.5 rounded-full bg-gray-600 ${color}`}>
											<Icon className="h-3 w-3" />
										</div>

										<div className="flex-1 min-w-0">
											<p className="text-sm text-white font-medium">{activity.message}</p>

											{/* Compact user and time info */}
											<div className="flex items-center gap-3 mt-1 text-xs text-gray-200">
												<div className="flex items-center gap-1">
													<User className="h-2.5 w-2.5" />
													<span>
														{activity.user.firstName} {activity.user.lastName}
													</span>
												</div>
												<div className="flex items-center gap-1">
													<Clock className="h-2.5 w-2.5" />
													<span>{formatDate(activity.createdAt)}</span>
												</div>
											</div>

											{/* IP and location info */}
											{details.ipAddress && (
												<div className="flex items-center gap-1 mt-1 text-xs text-gray-200">
													<MapPin className="h-2.5 w-2.5" />
													<span>
														{String(details.ipAddress)}
														{details.location && typeof details.location === "object" && (
															<span className="ml-1">
																({(details.location as { city?: string; country?: string }).city}, {(details.location as { city?: string; country?: string }).country})
															</span>
														)}
													</span>
												</div>
											)}
										</div>
									</div>
								</div>
							);
						})}
					</div>
				)}
			</div>

			{/* Compact Pagination */}
			{data?.pagination && data.pagination.pages > 1 && (
				<div className="flex items-center justify-between text-xs">
					<div className="text-gray-200">
						{data.pagination.total} total activities
					</div>
					<div className="flex items-center space-x-2">
						<button
							onClick={() => handleFilterChange("page", Math.max(1, filters.page - 1))}
							disabled={filters.page === 1}
							className="px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
						>
							Prev
						</button>
						<span className="text-gray-200">
							{data.pagination.current} / {data.pagination.pages}
						</span>
						<button
							onClick={() => handleFilterChange("page", Math.min(data.pagination.pages, filters.page + 1))}
							disabled={filters.page === data.pagination.pages}
							className="px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
						>
							Next
						</button>
					</div>
				</div>
			)}
		</div>
	);
};