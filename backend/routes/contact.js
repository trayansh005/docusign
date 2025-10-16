import express from 'express';
import { submitContactForm, validateContactForm } from '../controllers/contactController.js';

const router = express.Router();

// POST /api/contact - Submit contact form
router.post('/', validateContactForm, submitContactForm);

export default router;