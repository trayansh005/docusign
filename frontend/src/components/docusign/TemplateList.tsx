"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
	FileText,
	Eye,
	Edit,
	Trash2,
	AlertCircle,
	CheckCircle,
	Clock,
	Archive,
} from "lucide-react";
import { getTemplates, deleteTemplate } from "@/services/docusignAPI";
import { DocuSignTemplateData } from "@/types/docusign";

interface TemplateListProps {
	onViewTemplate?: (template: DocuSignTemplateData) => void;
	onEditTemplate?: (template: DocuSignTemplateData) => void;
	className?: string;
}

export const TemplateList: React.FC<TemplateListProps> = ({
	onViewTemplate,
	onEditTemplate,
	className = "",
}) => {
	const [currentPage, setCurrentPage] = useState(1);
	const [searchTerm, setSearchTerm] = useState("");
	const [statusFilter, setStatusFilter] = useState<string>("all");
	const queryClient = useQueryClient();

	const { data, isLoading, error } = useQuery({
		queryKey: ["docusign-templates", currentPage, searchTerm, statusFilter],
		queryFn: () =>
			getTemplates({
				page: currentPage,
				limit: 10,
				search: searchTerm || undefined,
				status: statusFilter !== "all" ? statusFilter : undefined,
			}),
	});

	const deleteMutation = useMutation({
		mutationFn: deleteTemplate,
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["docusign-templates"] });
		},
	});

	const getStatusIcon = (status: string) => {
		switch (status) {
			case "active":
				return <CheckCircle className="h-4 w-4 text-green-500" />;
			case "draft":
				return <Edit className="h-4 w-4 text-yellow-500" />;
			case "processing":
				return <Clock className="h-4 w-4 text-blue-500" />;
			case "final":
				return <Archive className="h-4 w-4 text-purple-500" />;
			case "failed":
				return <AlertCircle className="h-4 w-4 text-red-500" />;
			default:
				return <FileText className="h-4 w-4 text-gray-300" />;
		}
	};

	const getStatusColor = (status: string) => {
		switch (status) {
			case "active":
				return "bg-emerald-50 text-emerald-700 border-emerald-200";
			case "draft":
				return "bg-amber-50 text-amber-700 border-amber-200";
			case "processing":
				return "bg-sky-50 text-sky-700 border-sky-200";
			case "final":
				return "bg-violet-50 text-violet-700 border-violet-200";
			case "failed":
				return "bg-red-50 text-red-700 border-red-200";
			default:
				return "bg-slate-50 text-slate-700 border-slate-200";
		}
	};

	const formatFileSize = (bytes: number) => {
		const mb = bytes / (1024 * 1024);
		return mb < 1 ? `${(mb * 1024).toFixed(0)} KB` : `${mb.toFixed(2)} MB`;
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

	if (isLoading) {
		return (
			<div className={`flex flex-col items-center justify-center p-12 ${className}`}>
				<div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-200 border-t-blue-600 mb-4"></div>
				<span className="text-lg font-medium text-slate-700">Loading templates...</span>
				<span className="text-sm text-slate-500 mt-1">
					Please wait while we fetch your templates
				</span>
			</div>
		);
	}

	if (error) {
		return (
			<div className={`bg-white border border-red-200 rounded-xl p-8 text-center ${className}`}>
				<AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
				<div className="text-xl font-semibold text-red-700 mb-2">Failed to load templates</div>
				<div className="text-slate-600 mb-4">
					We encountered an error while loading your templates.
				</div>
				<button
					onClick={() => window.location.reload()}
					className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
				>
					Try Again
				</button>
			</div>
		);
	}

	return (
		<div className={`space-y-6 ${className}`}>
			{/* Filters */}
			<div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
				<div className="flex flex-col sm:flex-row gap-4">
					<div className="flex-1">
						<label
							htmlFor="search-templates"
							className="block text-sm font-medium text-slate-700 mb-2"
						>
							Search Templates
						</label>
						<input
							id="search-templates"
							type="text"
							placeholder="Search by filename..."
							value={searchTerm}
							onChange={(e) => setSearchTerm(e.target.value)}
							className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors bg-white"
						/>
					</div>
					<div className="sm:w-48">
						<label
							htmlFor="status-filter"
							className="block text-sm font-medium text-slate-700 mb-2"
						>
							Status Filter
						</label>
						<select
							id="status-filter"
							value={statusFilter}
							onChange={(e) => setStatusFilter(e.target.value)}
							className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors bg-white"
						>
							<option value="all">All Status</option>
							<option value="active">Active</option>
							<option value="draft">Draft</option>
							<option value="processing">Processing</option>
							<option value="final">Final</option>
							<option value="archived">Archived</option>
							<option value="failed">Failed</option>
						</select>
					</div>
				</div>
			</div>

			{/* Templates List */}
			<div className="space-y-4">
				{data?.data.length === 0 ? (
					<div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
						<FileText className="h-16 w-16 text-slate-300 mx-auto mb-4" />
						<div className="text-xl font-semibold text-slate-900 mb-2">No templates found</div>
						<div className="text-slate-600 mb-6">
							{searchTerm || statusFilter !== "all"
								? "Try adjusting your search or filters to find what you're looking for"
								: "Get started by uploading a PDF or Word document to create your first template"}
						</div>
						{!searchTerm && statusFilter === "all" && (
							<button className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium">
								Upload Document
							</button>
						)}
					</div>
				) : (
					data?.data.map((template) => (
						<div
							key={template._id}
							className="group bg-white border border-slate-200 rounded-xl p-6 hover:shadow-lg hover:border-slate-300 transition-all duration-200 hover:-translate-y-0.5"
						>
							<div className="flex items-start justify-between">
								<div className="flex items-start space-x-4 flex-1">
									<div className="flex-shrink-0 mt-1">{getStatusIcon(template.status)}</div>
									<div className="flex-1 min-w-0">
										<div className="flex items-center space-x-3 mb-3">
											<h3 className="text-lg font-semibold text-slate-900 truncate">
												{template.metadata?.filename || template.name || "Untitled Template"}
											</h3>
											<span
												className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(
													template.status
												)}`}
											>
												{template.status}
											</span>
										</div>
										<div className="grid grid-cols-2 gap-4 text-sm text-slate-600">
											<div className="flex items-center space-x-2">
												<span className="font-medium">Pages:</span>
												<span>{template.numPages || 0}</span>
											</div>
											<div className="flex items-center space-x-2">
												<span className="font-medium">Size:</span>
												<span>
													{template.metadata?.fileSize
														? formatFileSize(template.metadata.fileSize)
														: "Unknown"}
												</span>
											</div>
											<div className="flex items-center space-x-2">
												<span className="font-medium">Fields:</span>
												<span>{template.signatureFields?.length || 0}</span>
											</div>
											<div className="flex items-center space-x-2">
												<span className="font-medium">Created:</span>
												<span>
													{template.createdAt ? formatDate(template.createdAt) : "Unknown"}
												</span>
											</div>
											{template.createdBy && (
												<div className="col-span-2 flex items-center space-x-2">
													<span className="font-medium">By:</span>
													<span>
														{template.createdBy.firstName} {template.createdBy.lastName}
													</span>
												</div>
											)}
										</div>
									</div>
								</div>
								<div className="flex items-center space-x-1 ml-4">
									<button
										onClick={() => onViewTemplate?.(template)}
										className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all duration-200 group-hover:bg-slate-50"
										title="View template"
									>
										<Eye className="h-5 w-5" />
									</button>
									<button
										onClick={() => onEditTemplate?.(template)}
										className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all duration-200 group-hover:bg-slate-50"
										title="Edit template"
									>
										<Edit className="h-5 w-5" />
									</button>
									<button
										onClick={() => {
											if (confirm("Are you sure you want to delete this template?")) {
												deleteMutation.mutate(template._id);
											}
										}}
										disabled={deleteMutation.isPending}
										className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all duration-200 group-hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
										title="Delete template"
									>
										<Trash2 className="h-5 w-5" />
									</button>
								</div>
							</div>
						</div>
					))
				)}
			</div>

			{/* Pagination */}
			{data?.pagination && data.pagination.pages > 1 && (
				<div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
					<div className="flex items-center justify-between">
						<div className="text-sm text-slate-600 font-medium">
							Showing {(data.pagination.current - 1) * data.pagination.limit + 1} to{" "}
							{Math.min(data.pagination.current * data.pagination.limit, data.pagination.total)} of{" "}
							{data.pagination.total} templates
						</div>
						<div className="flex items-center space-x-3">
							<button
								onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
								disabled={currentPage === 1}
								className="px-4 py-2 text-sm font-medium border border-slate-300 rounded-lg hover:bg-slate-50 hover:border-slate-400 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white transition-colors"
							>
								Previous
							</button>
							<div className="flex items-center space-x-2">
								<span className="text-sm font-medium text-slate-700">
									Page {data.pagination.current} of {data.pagination.pages}
								</span>
							</div>
							<button
								onClick={() => setCurrentPage((prev) => Math.min(data.pagination.pages, prev + 1))}
								disabled={currentPage === data.pagination.pages}
								className="px-4 py-2 text-sm font-medium border border-slate-300 rounded-lg hover:bg-slate-50 hover:border-slate-400 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white transition-colors"
							>
								Next
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
};
