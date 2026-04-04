import { submitContactForm, contactSchema } from '../controllers/contactController.js';

/**
 * Contact routes Fastify plugin
 */
export default async function contactRoutes(fastify, options) {
  // POST /api/contact - Submit contact form
  fastify.post('/', { schema: contactSchema }, submitContactForm);
}