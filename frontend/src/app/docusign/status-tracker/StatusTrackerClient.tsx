"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
	MapPin,
	User,
	Calendar,
	ExternalLink
} from "lucide-react";
import { getTemplatesByStatus, getTemplateStatusHistory, getSignedDocument, updateTemplateStatus } from "@/services/docusignAPI";
import { DocuSignTemplateData, StatusHistoryData } from "@/types/docusign";

type StatusFilter = "all" | "draft" | "active" | "final" | "archived" | "processing" | "failed";

const statusConfig: Record<string, { icon: React.ComponentType<{ className?: string }>, color: string, bgColor: string, label: string }> = {
	draft: { icon: FileText, color: "text-yellow-600", bgColor: "bg-yellow-100", label: "Draft" },
	active: { icon: Clock, color: "text-blue-600", bgColor: "bg-blue-100", label: "Active" },
	processing: { icon: Clock, color: "text-indigo-600", bgColor: "bg-indigo-100", label: "Processing" },
	final: { icon: CheckCircle, color: "text-green-600", bgColor: "bg-green-100", label: "Final" },
	archived: { icon: Archive, color: "text-gray-600", bgColor: "bg-gray-100", label: "Archived" },
	failed: { icon: AlertCircle, color: "text-red-600", bgColor: "bg-red-100", label: "Failed" },
};

export default function StatusTrackerClient() {
	const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
	const [selectedTemplate, setSelectedTemplate] = useState<DocuSignTemplateData | null>(null);
	const [showHistory, setShowHistory] = useState(false);
	const queryClient = useQueryClient();

	const { data: templates, isLoading } = useQuery({
		queryKey: ["templates-by-status", statusFilter],
		queryFn: () => getTemplatesByStatus({
			status: statusFilter !== "all" ? statusFilter : undefined,
			page: 1,
			limit: 50,
		}),
	});

	const { data: statusHistory } = useQuery({
		queryKey: ["template-status-history", selectedTemplate?._id],
		queryFn: () => selectedTemplate ? getTemplateStatusHistory(selectedTemplate._id) : null,
		enabled: !!selectedTemplate && showHistory,
	});

	const downloadMutation = useMutation({
		mutationFn: (templateId: string) => getSignedDocument(templateId),
		onSuccess: (data) => {
			// Handle download - could open in new tab or trigger download
			if (data.signedPages && data.signedPages.length > 0) {
				data.signedPages.forEach((page, index) => {
					const link = document.createElement("a");
					link.href = `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}${page.signedImageUrl}`;
					link.target = "_blank";
					link.download = `signed-page-${page.pageNumber}.png`;
					document.body.appendChild(link);
					link.click();
					document.body.removeChild(link);
				});
			}
		},
	});

	const statusUpdateMutation = useMutation({
		mutationFn: ({ templateId, status }: { templateId: string; status: string }) => 
			updateTemplateStatus(templateId, status),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["templates-by-status"] });
			setSelectedTemplate(null);
		},
	});

	const getStatusIcon = (status: string) => {
		const config = statusConfig[status];
		if (!config) return { icon: FileText, color: "text-gray-600", bgColor: "bg-gray-100" };
		return config;
	};

	const formatDate = (dateString: string) => {
		return new Date(dateString).toLocaleDateString("en-US", {
			year: "numeric",
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

	if (isLoading) {
		return (
			<div className="flex items-center justify-center py-12">
				<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
				<span className="ml-2 text-gray-300">Loading documents...</span>
			</div>
		);
	}

	return (
		<div className="space-y-6">
			{/* Status Filter Tabs */}
			<div className="bg-gray-800/50 rounded-lg p-6">
				<div className="flex flex-wrap gap-2">
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
								className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
									isActive
										? "bg-blue-600 text-white"
										: "bg-gray-700 text-gray-300 hover:bg-gray-600"
								}`}
							>
								<Icon className="h-4 w-4" />
								<span>{config.label}</span>
								<span className={`px-2 py-0.5 rounded-full text-xs ${
									isActive ? "bg-blue-500" : "bg-gray-600"
								}`}>
									{count}
								</span>
							</button>
						);
					})}
				</div>
			</div>

			{/* Documents List */}
			<div className="bg-gray-800/50 rounded-lg">
				{templates?.data.length === 0 ? (
					<div className="text-center py-12">
						<BarChart3 className="mx-auto h-12 w-12 text-gray-400 mb-4" />
						<h3 className="text-lg font-medium text-white mb-2">No documents found</h3>
						<p className="text-gray-400">
							{statusFilter !== "all" 
								? `No documents with ${statusConfig[statusFilter]?.label.toLowerCase()} status`
								: "No documents available"
							}
						</p>
					</div>
				) : (
					<div className="divide-y divide-gray-700">
						{templates?.data.map((template) => {
							const { icon: Icon, color, bgColor } = getStatusIcon(template.status);
							
							return (
								<div key={template._id} className="p-6 hover:bg-gray-700/30 transition-colors">
									<div className="flex items-center justify-between">
										<div className="flex items-center gap-4 flex-1">
											<div className={`p-2 rounded-lg ${bgColor}`}>
												<Icon className={`h-5 w-5 ${color}`} />
											</div>
											
											<div className="flex-1 min-w-0">
												<div className="flex items-center gap-2 mb-1">
													<h3 className="text-lg font-medium text-white truncate">
														{template.metadata.filename}
													</h3>
													<span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${bgColor} ${color}`}>
														{statusConfig[template.status]?.label || template.status}
													</span>
												</div>
												
												<div className="flex items-center gap-4 text-sm text-gray-400">
													<div className="flex items-center gap-1">
														<FileText className="h-3 w-3" />
														<span>{template.numPages} pages</span>
													</div>
													<div className="flex items-center gap-1">
														<Calendar className="h-3 w-3" />
														<span>Created {formatDate(template.createdAt)}</span>
													</div>
													{template.createdBy && (
														<div className="flex items-center gap-1">
															<User className="h-3 w-3" />
															<span>{template.createdBy.firstName} {template.createdBy.lastName}</span>
														</div>
													)}
												</div>
											</div>
										</div>
										
										<div className="flex items-center gap-2">
											{template.status === "final" && (
												<button
													onClick={() => downloadMutation.mutate(template._id)}
													disabled={downloadMutation.isPending}
													className="p-2 text-gray-400 hover:text-green-400 hover:bg-green-400/10 rounded-lg transition-colors"
													title="Download signed document"
												>
													<Download className="h-4 w-4" />
												</button>
											)}
											
											<button
												onClick={() => {
													setSelectedTemplate(template);
													setShowHistory(true);
												}}
												className="p-2 text-gray-400 hover:text-blue-400 hover:bg-blue-400/10 rounded-lg transition-colors"
												title="View history"
											>
												<History className="h-4 w-4" />
											</button>
											
											<button
												onClick={() => setSelectedTemplate(template)}
												className="p-2 text-gray-400 hover:text-white hover:bg-gray-600 rounded-lg transition-colors"
												title="View details"
											>
												<Eye className="h-4 w-4" />
											</button>
										</div>
									</div>
								</div>
							);
						})}
					</div>
				)}
			</div>

			{/* Template Details Modal */}
			{selectedTemplate && (
				<div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
					<div className="bg-gray-800 rounded-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto">
						<div className="p-6 border-b border-gray-700">
							<div className="flex items-center justify-between">
								<h2 className="text-xl font-semibold text-white">Document Details</h2>
								<button
									onClick={() => {
										setSelectedTemplate(null);
										setShowHistory(false);
									}}
									className="text-gray-400 hover:text-white"
								>
									×
								</button>
							</div>
						</div>
						
						<div className="p-6 space-y-6">
							{/* Basic Info */}
							<div>
								<h3 className="text-lg font-medium text-white mb-3">Basic Information</h3>
								<div className="grid grid-cols-2 gap-4 text-sm">
									<div>
										<span className="text-gray-400">Name:</span>
										<p className="text-white">{selectedTemplate.metadata.filename}</p>
									</div>
									<div>
										<span className="text-gray-400">Status:</span>
										<p className="text-white">{statusConfig[selectedTemplate.status]?.label || selectedTemplate.status}</p>
									</div>
									<div>
										<span className="text-gray-400">Pages:</span>
										<p className="text-white">{selectedTemplate.numPages}</p>
									</div>
									<div>
										<span className="text-gray-400">Signature Fields:</span>
										<p className="text-white">{selectedTemplate.signatureFields.length}</p>
									</div>
									<div>
										<span className="text-gray-400">Created:</span>
										<p className="text-white">{formatDate(selectedTemplate.createdAt)}</p>
									</div>
									<div>
										<span className="text-gray-400">Updated:</span>
										<p className="text-white">{formatDate(selectedTemplate.updatedAt)}</p>
									</div>
								</div>
							</div>

							{/* Status History */}
							{showHistory && statusHistory && (
								<div>
									<h3 className="text-lg font-medium text-white mb-3">Status History</h3>
									<div className="space-y-3">
										{statusHistory.auditTrail.map((entry, index) => (
											<div key={index} className="flex items-start gap-3 p-3 bg-gray-700/50 rounded-lg">
												<div className="flex-shrink-0 w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
												<div className="flex-1">
													<div className="flex items-center justify-between">
														<p className="text-white font-medium capitalize">{entry.action}</p>
														<span className="text-xs text-gray-400">{formatDate(entry.timestamp)}</span>
													</div>
													<p className="text-gray-300 text-sm mt-1">{entry.details}</p>
													{entry.ipAddress && (
														<div className="flex items-center gap-1 mt-2 text-xs text-gray-400">
															<MapPin className="h-3 w-3" />
															<span>
																{entry.ipAddress}
																{entry.location && (
																	<span className="ml-1">
																		({entry.location.city}, {entry.location.country})
																	</span>
																)}
															</span>
														</div>
													)}
												</div>
											</div>
										))}
									</div>
								</div>
							)}

							{/* Actions */}
							<div className="flex gap-3">
								{selectedTemplate.status === "final" && (
									<button
										onClick={() => downloadMutation.mutate(selectedTemplate._id)}
										disabled={downloadMutation.isPending}
										className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
									>
										<Download className="h-4 w-4" />
										Download Signed
									</button>
								)}
								
								{selectedTemplate.status !== "archived" && (
									<button
										onClick={() => statusUpdateMutation.mutate({ 
											templateId: selectedTemplate._id, 
											status: "archived" 
										})}
										disabled={statusUpdateMutation.isPending}
										className="flex items-center gap-2 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
									>
										<Archive className="h-4 w-4" />
										Archive
									</button>
								)}
							</div>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}