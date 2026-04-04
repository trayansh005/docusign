/**
 * Validation schema for contact form
 */
export const contactSchema = {
  body: {
    type: 'object',
    required: ['name', 'email', 'subject', 'message', 'category'],
    properties: {
      name: { type: 'string', minLength: 2, maxLength: 100 },
      email: { type: 'string', format: 'email' },
      subject: { type: 'string', minLength: 5, maxLength: 200 },
      message: { type: 'string', minLength: 10, maxLength: 2000 },
      category: { 
        type: 'string', 
        enum: ['general', 'support', 'billing', 'feature', 'bug', 'partnership'] 
      }
    }
  }
};

// Contact form submission handler
export const submitContactForm = async (request, reply) => {
  try {
    const { name, email, subject, message, category } = request.body;

    // Log the contact form submission
    request.log.info({
      name,
      email,
      subject,
      category,
      timestamp: new Date().toISOString(),
      ip: request.ip,
      userAgent: request.headers['user-agent']
    }, 'Contact form submission');

    // For now, just return success response
    return {
      success: true,
      message: 'Thank you for your message! We will get back to you soon.',
      data: {
        submittedAt: new Date().toISOString(),
        category,
        subject
      }
    };

  } catch (error) {
    request.log.error('Contact form submission error:', error);
    return reply.status(500).send({
      success: false,
      message: 'Failed to submit contact form. Please try again later.'
    });
  }
};