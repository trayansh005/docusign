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
				return "bg-green-100 text-green-800";
			case "draft":
				return "bg-yellow-100 text-yellow-800";
			case "processing":
				return "bg-blue-100 text-blue-800";
			case "final":
				return "bg-purple-100 text-purple-800";
			case "failed":
				return "bg-red-100 text-red-800";
			default:
				return "bg-gray-100 text-gray-800";
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
			<div className={`flex items-center justify-center p-8 ${className}`}>
				<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
				<span className="ml-2 text-gray-600">Loading templates...</span>
			</div>
		);
	}

	if (error) {
		return (
			<div className={`p-8 text-center ${className}`}>
				<AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
				<div className="text-lg font-medium text-red-700 mb-2">Failed to load templates</div>
				<div className="text-sm text-gray-600">Please try again later</div>
			</div>
		);
	}

	return (
		<div className={`space-y-6 ${className}`}>
			{/* Filters */}
			<div className="flex flex-col sm:flex-row gap-4">
				<div className="flex-1">
					<input
						type="text"
						placeholder="Search templates..."
						value={searchTerm}
						onChange={(e) => setSearchTerm(e.target.value)}
						className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
					/>
				</div>
				<div className="sm:w-48">
					<select
						value={statusFilter}
						onChange={(e) => setStatusFilter(e.target.value)}
						className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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

			{/* Templates List */}
			<div className="space-y-4">
				{data?.data.length === 0 ? (
					<div className="text-center py-12">
						<FileText className="h-12 w-12 text-gray-300 mx-auto mb-4" />
						<div className="text-lg font-medium text-gray-900 mb-2">No templates found</div>
						<div className="text-sm text-gray-600">
							{searchTerm || statusFilter !== "all"
								? "Try adjusting your search or filters"
								: "Upload a PDF to create your first template"}
						</div>
					</div>
				) : (
					data?.data.map((template) => (
						<div
							key={template._id}
							className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow"
						>
							<div className="flex items-start justify-between">
								<div className="flex items-start space-x-4 flex-1">
									<div className="flex-shrink-0">{getStatusIcon(template.status)}</div>
									<div className="flex-1 min-w-0">
										<div className="flex items-center space-x-2 mb-2">
											<h3 className="text-lg font-medium text-gray-900 truncate">
												{template.metadata.filename}
											</h3>
											<span
												className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(
													template.status
												)}`}
											>
												{template.status}
											</span>
										</div>
										<div className="text-sm text-gray-600 space-y-1">
											<div>Pages: {template.numPages}</div>
											<div>Size: {formatFileSize(template.metadata.fileSize)}</div>
											<div>Fields: {template.signatureFields.length}</div>
											<div>Created: {formatDate(template.createdAt)}</div>
											{template.createdBy && (
												<div>
													By: {template.createdBy.firstName} {template.createdBy.lastName}
												</div>
											)}
										</div>
									</div>
								</div>
								<div className="flex items-center space-x-2">
									<button
										onClick={() => onViewTemplate?.(template)}
										className="p-2 text-gray-300 hover:text-blue-400 hover:bg-blue-900/20 rounded-lg transition-colors"
										title="View template"
									>
										<Eye className="h-4 w-4" />
									</button>
									<button
										onClick={() => onEditTemplate?.(template)}
										className="p-2 text-gray-300 hover:text-green-400 hover:bg-green-900/20 rounded-lg transition-colors"
										title="Edit template"
									>
										<Edit className="h-4 w-4" />
									</button>
									<button
										onClick={() => {
											if (confirm("Are you sure you want to delete this template?")) {
												deleteMutation.mutate(template._id);
											}
										}}
										disabled={deleteMutation.isPending}
										className="p-2 text-gray-300 hover:text-red-400 hover:bg-red-900/20 rounded-lg transition-colors disabled:opacity-50"
										title="Delete template"
									>
										<Trash2 className="h-4 w-4" />
									</button>
								</div>
							</div>
						</div>
					))
				)}
			</div>

			{/* Pagination */}
			{data?.pagination && data.pagination.pages > 1 && (
				<div className="flex items-center justify-between">
					<div className="text-sm text-gray-600">
						Showing {(data.pagination.current - 1) * data.pagination.limit + 1} to{" "}
						{Math.min(data.pagination.current * data.pagination.limit, data.pagination.total)} of{" "}
						{data.pagination.total} templates
					</div>
					<div className="flex items-center space-x-2">
						<button
							onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
							disabled={currentPage === 1}
							className="px-3 py-1 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
						>
							Previous
						</button>
						<span className="text-sm text-gray-600">
							Page {data.pagination.current} of {data.pagination.pages}
						</span>
						<button
							onClick={() => setCurrentPage((prev) => Math.min(data.pagination.pages, prev + 1))}
							disabled={currentPage === data.pagination.pages}
							className="px-3 py-1 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
						>
							Next
						</button>
					</div>
				</div>
			)}
		</div>
	);
};
