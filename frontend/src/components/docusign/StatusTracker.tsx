"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
	BarChart3,
	FileText,
	CheckCircle,
	Clock,
	AlertCircle,
	Archive,
	Eye,
	Download,
	History,
	Calendar,
	User
} from "lucide-react";
import { getTemplatesByStatus, getSignedDocument } from "@/services/docusignAPI";
import { DocuSignTemplateData } from "@/types/docusign";

type StatusFilter = "all" | "draft" | "active" | "final" | "archived" | "processing" | "failed";

const statusConfig: Record<string, { icon: React.ComponentType<{ className?: string }>, color: string, bgColor: string, label: string }> = {
	draft: { icon: FileText, color: "text-yellow-600", bgColor: "bg-yellow-100", label: "Draft" },
	active: { icon: Clock, color: "text-blue-600", bgColor: "bg-blue-100", label: "Active" },
	processing: { icon: Clock, color: "text-indigo-600", bgColor: "bg-indigo-100", label: "Processing" },
	final: { icon: CheckCircle, color: "text-green-600", bgColor: "bg-green-100", label: "Final" },
	archived: { icon: Archive, color: "text-gray-600", bgColor: "bg-gray-100", label: "Archived" },
	failed: { icon: AlertCircle, color: "text-red-600", bgColor: "bg-red-100", label: "Failed" },
};

interface StatusTrackerProps {
	className?: string;
	onTemplateSelect?: (template: DocuSignTemplateData) => void;
}

export const StatusTracker: React.FC<StatusTrackerProps> = ({ className = "", onTemplateSelect }) => {
	const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

	const { data: templates, isLoading } = useQuery({
		queryKey: ["templates-by-status", statusFilter],
		queryFn: () => getTemplatesByStatus({
			status: statusFilter !== "all" ? statusFilter : undefined,
			page: 1,
			limit: 20,
		}),
	});

	const getStatusIcon = (status: string) => {
		const config = statusConfig[status];
		if (!config) return { icon: FileText, color: "text-gray-600", bgColor: "bg-gray-100" };
		return config;
	};

	const formatDate = (dateString: string) => {
		return new Date(dateString).toLocaleDateString("en-US", {
			month: "short",
			day: "numeric",
			hour: "2-digit",
			minute: "2-digit",
		});
	};

	const getStatusCounts = () => {
		if (!templates?.data) return {};

		const counts: Record<string, number> = {
			all: templates.data.length,
			draft: 0,
			active: 0,
			processing: 0,
			final: 0,
			archived: 0,
			failed: 0,
		};

		templates.data.forEach(template => {
			counts[template.status] = (counts[template.status] || 0) + 1;
		});

		return counts;
	};

	const statusCounts = getStatusCounts();

	const handleDownload = async (templateId: string) => {
		try {
			const data = await getSignedDocument(templateId);
			if (data.signedPages && data.signedPages.length > 0) {
				data.signedPages.forEach((page) => {
					const link = document.createElement("a");
					link.href = `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}${page.signedImageUrl}`;
					link.target = "_blank";
					link.download = `signed-page-${page.pageNumber}.png`;
					document.body.appendChild(link);
					link.click();
					document.body.removeChild(link);
				});
			}
		} catch (error) {
			console.error("Failed to download signed document:", error);
		}
	};

	if (isLoading) {
		return (
			<div className={`flex items-center justify-center py-8 ${className}`}>
				<div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
				<span className="ml-2 text-gray-200">Loading documents...</span>
			</div>
		);
	}

	return (
		<div className={`space-y-4 ${className}`}>
			{/* Compact Status Filter */}
			<div className="flex flex-wrap gap-1">
				{(["all", "draft", "active", "processing", "final", "archived", "failed"] as StatusFilter[]).map((status) => {
					const config = status === "all" ?
						{ icon: BarChart3, color: "text-blue-600", bgColor: "bg-blue-100", label: "All" } :
						statusConfig[status];
					const Icon = config.icon;
					const count = statusCounts[status] || 0;
					const isActive = statusFilter === status;

					return (
						<button
							key={status}
							onClick={() => setStatusFilter(status)}
							className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors ${isActive
								? "bg-blue-600 text-white"
								: "bg-gray-700 text-gray-200 hover:bg-gray-600"
								}`}
						>
							<Icon className="h-3 w-3" />
							<span>{config.label}</span>
							<span className={`px-1 py-0.5 rounded text-xs ${isActive ? "bg-blue-500" : "bg-gray-600"
								}`}>
								{count}
							</span>
						</button>
					);
				})}
			</div>

			{/* Compact Documents List */}
			<div className="bg-gray-700/30 rounded-lg max-h-80 overflow-y-auto">
				{templates?.data.length === 0 ? (
					<div className="text-center py-8">
						<BarChart3 className="mx-auto h-8 w-8 text-gray-300 mb-2" />
						<h3 className="text-sm font-medium text-white mb-1">No documents found</h3>
						<p className="text-xs text-gray-200">
							{statusFilter !== "all"
								? `No documents with ${statusConfig[statusFilter]?.label.toLowerCase()} status`
								: "No documents available"
							}
						</p>
					</div>
				) : (
					<div className="divide-y divide-gray-600">
						{templates?.data.map((template) => {
							const { icon: Icon, color, bgColor } = getStatusIcon(template.status);

							return (
								<div key={template._id} className="p-3 hover:bg-gray-600/30 transition-colors">
									<div className="flex items-center justify-between">
										<div className="flex items-center gap-3 flex-1 min-w-0">
											<div className={`p-1.5 rounded ${bgColor}`}>
												<Icon className={`h-3 w-3 ${color}`} />
											</div>

											<div className="flex-1 min-w-0">
												<div className="flex items-center gap-2 mb-1">
													<h3 className="text-sm font-medium text-white truncate">
														{template.metadata.filename}
													</h3>
													<span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${bgColor} ${color}`}>
														{statusConfig[template.status]?.label || template.status}
													</span>
												</div>

												<div className="flex items-center gap-3 text-xs text-gray-200">
													<div className="flex items-center gap-1">
														<FileText className="h-2.5 w-2.5" />
														<span>{template.numPages}p</span>
													</div>
													<div className="flex items-center gap-1">
														<Calendar className="h-2.5 w-2.5" />
														<span>{formatDate(template.createdAt)}</span>
													</div>
													{template.createdBy && (
														<div className="flex items-center gap-1">
															<User className="h-2.5 w-2.5" />
															<span>{template.createdBy.firstName}</span>
														</div>
													)}
												</div>
											</div>
										</div>

										<div className="flex items-center gap-1">
											{template.status === "final" && (
												<button
													onClick={() => handleDownload(template._id)}
													className="p-1.5 text-gray-300 hover:text-green-400 hover:bg-green-400/10 rounded transition-colors"
													title="Download signed document"
												>
													<Download className="h-3 w-3" />
												</button>
											)}

											<button
												onClick={() => onTemplateSelect?.(template)}
												className="p-1.5 text-gray-300 hover:text-white hover:bg-gray-600 rounded transition-colors"
												title="View details"
											>
												<Eye className="h-3 w-3" />
											</button>
										</div>
									</div>
								</div>
							);
						})}
					</div>
				)}
			</div>
		</div>
	);
};