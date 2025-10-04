/**
 * Optimized template management hook
 * Reduces re-renders and improves performance
 */

import { useState, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DocuSignTemplateData, SignatureField } from '@/types/docusign';
import { getTemplates, deleteTemplate, updateTemplatePageFields } from '@/services/docusignAPI';

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
		...initialFilters
	});

	// Memoized query key to prevent unnecessary refetches
	const queryKey = useMemo(() => ['templates', filters], [filters]);

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
		setFilters(prev => ({
			...prev,
			...newFilters,
			// Reset page when other filters change
			...(Object.keys(newFilters).some(key => key !== 'page') && { page: 1 })
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
			queryClient.setQueryData(queryKey, (old: any) => {
				if (!old?.data) return old;
				return {
					...old,
					data: old.data.filter((template: DocuSignTemplateData) => template._id !== templateId)
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

	// Update fields mutation with optimistic updates
	const updateFieldsMutation = useMutation({
		mutationFn: ({ templateId, pageNumber, fields }: {
			templateId: string;
			pageNumber: number;
			fields: SignatureField[];
		}) => updateTemplatePageFields(templateId, pageNumber, fields),
		onMutate: async ({ templateId, fields }) => {
			// Optimistically update template in cache
			const templateQueryKey = ['template', templateId];
			const previousTemplate = queryClient.getQueryData(templateQueryKey);

			queryClient.setQueryData(templateQueryKey, (old: any) => {
				if (!old) return old;
				return {
					...old,
					signatureFields: fields
				};
			});

			return { previousTemplate, templateQueryKey };
		},
		onError: (err, variables, context) => {
			// Rollback on error
			if (context?.previousTemplate && context?.templateQueryKey) {
				queryClient.setQueryData(context.templateQueryKey, context.previousTemplate);
			}
		},
	});

	// Memoized computed values
	const computedValues = useMemo(() => {
		const { data, isLoading, error } = templatesQuery;
		
		return {
			templates: data?.data || [],
			pagination: data?.pagination,
			isLoading,
			error,
			hasTemplates: (data?.data?.length || 0) > 0,
			totalCount: data?.pagination?.total || 0
		};
	}, [templatesQuery.data, templatesQuery.isLoading, templatesQuery.error]);

	// Stable callback functions
	const actions = useMemo(() => ({
		deleteTemplate: deleteMutation.mutate,
		updateFields: updateFieldsMutation.mutate,
		refetch: templatesQuery.refetch,
		updateFilters,
		resetFilters: () => setFilters({ page: 1, limit: pageSize, ...initialFilters }),
	}), [deleteMutation.mutate, updateFieldsMutation.mutate, templatesQuery.refetch, updateFilters, pageSize, initialFilters]);

	return {
		...computedValues,
		filters,
		actions,
		mutations: {
			delete: deleteMutation,
			updateFields: updateFieldsMutation,
		}
	};
};