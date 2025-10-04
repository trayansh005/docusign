/**
 * Standardized API response handler
 * Reduces code duplication and ensures consistent error handling
 */

export const sendSuccess = (res, data, message = "Success", statusCode = 200) => {
    return res.status(statusCode).json({
        success: true,
        message,
        data,
        timestamp: new Date().toISOString()
    });
};

export const sendError = (res, message = "Internal Server Error", statusCode = 500, details = null) => {
    const response = {
        success: false,
        message,
        timestamp: new Date().toISOString()
    };

    if (details && process.env.NODE_ENV === 'development') {
        response.details = details;
    }

    return res.status(statusCode).json(response);
};

export const sendValidationError = (res, errors) => {
    return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors,
        timestamp: new Date().toISOString()
    });
};

export const asyncHandler = (fn) => {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};

export const handleDatabaseError = (error) => {
    if (error.name === 'ValidationError') {
        const errors = Object.values(error.errors).map(err => err.message);
        return { statusCode: 400, message: 'Validation failed', details: errors };
    }

    if (error.code === 11000) {
        return { statusCode: 409, message: 'Duplicate entry found' };
    }

    if (error.name === 'CastError') {
        return { statusCode: 400, message: 'Invalid ID format' };
    }

    return { statusCode: 500, message: 'Database operation failed' };
};