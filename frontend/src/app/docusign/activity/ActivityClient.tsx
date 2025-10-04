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
	Search
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

interface ActivityFilter {
	type: string;
	search: string;
	page: number;
	limit: number;
}

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

export default function ActivityClient() {
	const [filters, setFilters] = useState<ActivityFilter>({
		type: "all",
		search: "",
		page: 1,
		limit: 20,
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

	const handleFilterChange = (key: keyof ActivityFilter, value: string | number) => {
		setFilters(prev => ({
			...prev,
			[key]: value,
			...(key !== "page" && { page: 1 }) // Reset page when other filters change
		}));
	};

	if (isLoading) {
		return (
			<div className="flex items-center justify-center py-12">
				<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
				<span className="ml-2 text-gray-300">Loading activities...</span>
			</div>
		);
	}

	if (error) {
		return (
			<div className="text-center py-12">
				<History className="mx-auto h-12 w-12 text-red-400 mb-4" />
				<h3 className="text-lg font-medium text-white mb-2">Failed to load activities</h3>
				<p className="text-gray-400">Please try again later</p>
			</div>
		);
	}

	return (
		<div className="space-y-6">
			{/* Filters */}
			<div className="bg-gray-800/50 rounded-lg p-6">
				<div className="flex flex-col lg:flex-row gap-4">
					<div className="flex-1 relative">
						<Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
						<input
							type="text"
							placeholder="Search activities..."
							value={filters.search}
							onChange={(e) => handleFilterChange("search", e.target.value)}
							className="w-full pl-10 pr-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
						/>
					</div>
					<div className="lg:w-48">
						<select
							value={filters.type}
							onChange={(e) => handleFilterChange("type", e.target.value)}
							className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
						>
							<option value="all">All Activities</option>
							<option value="DOCUSIGN_TEMPLATE_CREATED">Created</option>
							<option value="DOCUSIGN_TEMPLATE_UPDATED">Updated</option>
							<option value="DOCUSIGN_TEMPLATE_SIGNED">Signed</option>
							<option value="DOCUSIGN_TEMPLATE_COMPLETED">Completed</option>
							<option value="DOCUSIGN_TEMPLATE_SENT">Sent</option>
							<option value="DOCUSIGN_TEMPLATE_DELETED">Deleted</option>
							<option value="DOCUSIGN_TEMPLATE_ARCHIVED">Archived</option>
						</select>
					</div>
					<div className="lg:w-32">
						<select
							value={filters.limit}
							onChange={(e) => handleFilterChange("limit", parseInt(e.target.value))}
							className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
						>
							<option value={10}>10 per page</option>
							<option value={20}>20 per page</option>
							<option value={50}>50 per page</option>
						</select>
					</div>
				</div>
			</div>

			{/* Activity List */}
			<div className="bg-gray-800/50 rounded-lg">
				{data?.data?.length === 0 ? (
					<div className="text-center py-12">
						<History className="mx-auto h-12 w-12 text-gray-400 mb-4" />
						<h3 className="text-lg font-medium text-white mb-2">No activities found</h3>
						<p className="text-gray-400">
							{filters.search || filters.type !== "all"
								? "Try adjusting your search or filters"
								: "DocuSign activities will appear here as you use the system"
							}
						</p>
					</div>
				) : (
					<div className="divide-y divide-gray-700">
						{data?.data?.map((activity) => {
							const { icon: Icon, color } = getActivityIcon(activity.type);
							const details: Record<string, unknown> = activity.details || {};

							return (
								<div key={activity._id} className="p-6 hover:bg-gray-700/30 transition-colors">
									<div className="flex items-start gap-4">
										<div className={`flex-shrink-0 p-2 rounded-full bg-gray-700 ${color}`}>
											<Icon className="h-4 w-4" />
										</div>

										<div className="flex-1 min-w-0">
											<div className="flex items-start justify-between">
												<div className="flex-1">
													<p className="text-white font-medium">{activity.message}</p>

													<div className="flex items-center gap-4 mt-2 text-sm text-gray-400">
														<div className="flex items-center gap-1">
															<User className="h-3 w-3" />
															<span>
																{typeof activity.user === 'object' && activity.user !== null ? `${activity.user.firstName} ${activity.user.lastName}` : 'Unknown User'}
															</span>
														</div>
														<div className="flex items-center gap-1">
															<Clock className="h-3 w-3" />
															<span>{formatDate(activity.createdAt)}</span>
														</div>
													</div>

													{details.templateId ? (
														<div className="mt-2 text-sm text-gray-400">
															Template ID: <span className="font-mono text-gray-300">{String(details.templateId).slice(-8)}</span>
														</div>
													) : null}

													{details.ipAddress ? (
														<div className="flex items-center gap-1 mt-2 text-sm text-gray-400">
															<MapPin className="h-3 w-3" />
															<span>
																{String(details.ipAddress)}
																{details.location && typeof details.location === "object" ? (
																	<span className="ml-1">
																		({(details.location as { city?: string; country?: string })?.city}, {(details.location as { city?: string; country?: string })?.country})
																	</span>
																) : null}
															</span>
														</div>
													) : null}
												</div>

												<div className="text-xs text-gray-500 ml-4">
													{new Date(activity.createdAt).toLocaleTimeString("en-US", {
														hour: "2-digit",
														minute: "2-digit",
													})}
												</div>
											</div>
										</div>
									</div>
								</div>
							);
						})}
					</div>
				)}
			</div>

			{/* Pagination */}
			{data?.pagination && data.pagination.pages > 1 && (
				<div className="flex items-center justify-between bg-gray-800/50 rounded-lg p-4">
					<div className="text-sm text-gray-400">
						Showing {(data.pagination.current - 1) * data.pagination.limit + 1} to{" "}
						{Math.min(data.pagination.current * data.pagination.limit, data.pagination.total)} of{" "}
						{data.pagination.total} activities
					</div>
					<div className="flex items-center space-x-2">
						<button
							onClick={() => handleFilterChange("page", Math.max(1, filters.page - 1))}
							disabled={filters.page === 1}
							className="px-3 py-1 text-sm bg-gray-700 border border-gray-600 rounded-lg text-white hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
						>
							Previous
						</button>
						<span className="text-sm text-gray-400">
							Page {data.pagination.current} of {data.pagination.pages}
						</span>
						<button
							onClick={() => data?.pagination && handleFilterChange("page", Math.min(data.pagination.pages, filters.page + 1))}
							disabled={data?.pagination ? filters.page === data.pagination.pages : true}
							className="px-3 py-1 text-sm bg-gray-700 border border-gray-600 rounded-lg text-white hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
						>
							Next
						</button>
					</div>
				</div>
			)}
		</div>
	);
}