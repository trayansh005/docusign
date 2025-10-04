/**
 * Optimized template management hook
 * Reduces re-renders and improves performance
 */

import { useState, useCallback, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DocuSignTemplateData, ApiResponse } from "@/types/docusign";
import { getTemplates, deleteTemplate } from "@/services/docusignAPI";

interface UseTemplateManagerOptions {
	initialFilters?: {
		status?: string;
		type?: string;
		search?: string;
	};
	pageSize?: number;
}

export const useTemplateManager = (options: UseTemplateManagerOptions = {}) => {
	const { initialFilters = {}, pageSize = 10 } = options;
	const queryClient = useQueryClient();

	// Stable filter state
	const [filters, setFilters] = useState({
		page: 1,
		limit: pageSize,
		...initialFilters,
	});

	// Memoized query key to prevent unnecessary refetches
	const queryKey = useMemo(() => ["templates", filters], [filters]);

	// Templates query with optimized caching
	const templatesQuery = useQuery({
		queryKey,
		queryFn: () => getTemplates(filters),
		staleTime: 5 * 60 * 1000, // 5 minutes
		gcTime: 10 * 60 * 1000, // 10 minutes
		refetchOnWindowFocus: false,
	});

	// Optimized filter updates
	const updateFilters = useCallback((newFilters: Partial<typeof filters>) => {
		setFilters((prev) => ({
			...prev,
			...newFilters,
			// Reset page when other filters change
			...(Object.keys(newFilters).some((key) => key !== "page") && { page: 1 }),
		}));
	}, []);

	// Delete mutation with optimistic updates
	const deleteMutation = useMutation({
		mutationFn: deleteTemplate,
		onMutate: async (templateId) => {
			// Cancel outgoing refetches
			await queryClient.cancelQueries({ queryKey });

			// Snapshot previous value
			const previousData = queryClient.getQueryData(queryKey);

			// Optimistically update
			queryClient.setQueryData(queryKey, (old: ApiResponse<DocuSignTemplateData[]> | undefined) => {
				if (!old?.data) return old;
				return {
					...old,
					data: old.data.filter((template: DocuSignTemplateData) => template._id !== templateId),
				};
			});

			return { previousData };
		},
		onError: (err, templateId, context) => {
			// Rollback on error
			if (context?.previousData) {
				queryClient.setQueryData(queryKey, context.previousData);
			}
		},
		onSettled: () => {
			// Refetch to ensure consistency
			queryClient.invalidateQueries({ queryKey });
		},
	});

	// NOTE: Field updates are now handled individually via updateSignatureField() API
	// The old updateTemplatePageFields() function has been removed in favor of:
	// - addSignatureField(templateId, field)
	// - updateSignatureField(templateId, fieldId, updates)
	// - deleteSignatureField(templateId, fieldId)
	// Components should use these APIs directly instead of batch updates

	// Memoized computed values
	const computedValues = useMemo(() => {
		const { data, isLoading, error } = templatesQuery;

		return {
			templates: data?.data || [],
			pagination: data?.pagination,
			isLoading,
			error,
			hasTemplates: (data?.data?.length || 0) > 0,
			totalCount: data?.pagination?.total || 0,
		};
	}, [templatesQuery]);

	// Stable callback functions
	const actions = useMemo(
		() => ({
			deleteTemplate: deleteMutation.mutate,
			refetch: templatesQuery.refetch,
			updateFilters,
			resetFilters: () => setFilters({ page: 1, limit: pageSize, ...initialFilters }),
		}),
		[deleteMutation.mutate, templatesQuery.refetch, updateFilters, pageSize, initialFilters]
	);

	return {
		...computedValues,
		filters,
		actions,
		mutations: {
			delete: deleteMutation,
		},
	};
};
