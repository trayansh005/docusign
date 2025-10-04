/**
 * Database query optimization utilities
 */

// Common projection for template lists (exclude heavy fields)
export const TEMPLATE_LIST_PROJECTION = {
    name: 1,
    type: 1,
    status: 1,
    numPages: 1,
    createdAt: 1,
    updatedAt: 1,
    createdBy: 1,
    'metadata.filename': 1,
    'metadata.fileSize': 1,
    // Exclude heavy fields like signatureFields, auditTrail, metadata.pages
};

// Lean options for better performance
export const LEAN_OPTIONS = {
    lean: true,
    transform: (doc) => {
        // Remove MongoDB-specific fields
        delete doc.__v;
        return doc;
    }
};

// Pagination helper
export const buildPaginationQuery = (page = 1, limit = 10) => {
    const skip = (parseInt(page) - 1) * parseInt(limit);
    return {
        skip,
        limit: parseInt(limit),
        page: parseInt(page)
    };
};

// Build search query with indexes
export const buildSearchQuery = (search, additionalFilters = {}) => {
    const query = { isArchived: false, ...additionalFilters };

    if (search) {
        // Use text index if available, otherwise regex
        query.$or = [
            { name: { $regex: search, $options: 'i' } },
            { 'metadata.filename': { $regex: search, $options: 'i' } }
        ];
    }

    return query;
};

// Optimized template aggregation for status counts
export const getTemplateStatusCounts = async (Model, userId = null) => {
    const matchStage = { isArchived: false };
    if (userId) matchStage.createdBy = userId;

    return await Model.aggregate([
        { $match: matchStage },
        {
            $group: {
                _id: '$status',
                count: { $sum: 1 }
            }
        },
        {
            $group: {
                _id: null,
                statusCounts: {
                    $push: {
                        status: '$_id',
                        count: '$count'
                    }
                },
                total: { $sum: '$count' }
            }
        }
    ]);
};