import { body, validationResult } from 'express-validator';

// Contact form submission handler
export const submitContactForm = async (req, res) => {
    try {
        // Check for validation errors
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: errors.array()
            });
        }

        const { name, email, subject, message, category } = req.body;

        // Log the contact form submission (in production, you'd save to database or send email)
        console.log('Contact form submission:', {
            name,
            email,
            subject,
            message,
            category,
            timestamp: new Date().toISOString(),
            ip: req.ip,
            userAgent: req.get('User-Agent')
        });

        // TODO: In production, implement one or more of the following:
        // 1. Save to database
        // 2. Send email notification to support team
        // 3. Integrate with ticketing system
        // 4. Send auto-reply email to user

        // For now, just return success response
        res.status(200).json({
            success: true,
            message: 'Thank you for your message! We will get back to you soon.',
            data: {
                submittedAt: new Date().toISOString(),
                category,
                subject
            }
        });

    } catch (error) {
        console.error('Contact form submission error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to submit contact form. Please try again later.'
        });
    }
};

// Validation rules for contact form
export const validateContactForm = [
    body('name')
        .trim()
        .isLength({ min: 2, max: 100 })
        .withMessage('Name must be between 2 and 100 characters'),

    body('email')
        .isEmail()
        .normalizeEmail()
        .withMessage('Please provide a valid email address'),

    body('subject')
        .trim()
        .isLength({ min: 5, max: 200 })
        .withMessage('Subject must be between 5 and 200 characters'),

    body('message')
        .trim()
        .isLength({ min: 10, max: 2000 })
        .withMessage('Message must be between 10 and 2000 characters'),

    body('category')
        .isIn(['general', 'support', 'billing', 'feature', 'bug', 'partnership'])
        .withMessage('Please select a valid category')
];