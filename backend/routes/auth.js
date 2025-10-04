import express from "express";
import { body } from "express-validator";
import { validate } from "../middlewares/validation.js";
import { authenticateToken } from "../middleware/auth.js";
import {
	register,
	login,
	getProfile,
	updateProfile,
	changePassword,
	refreshToken,
	logout,
	validateToken,
} from "../controllers/authController.js";

const router = express.Router();

// Registration validation rules
const registerValidation = [
	body("firstName")
		.trim()
		.notEmpty()
		.withMessage("First name is required")
		.isLength({ min: 2, max: 50 })
		.withMessage("First name must be between 2-50 characters"),

	body("lastName")
		.trim()
		.notEmpty()
		.withMessage("Last name is required")
		.isLength({ min: 2, max: 50 })
		.withMessage("Last name must be between 2-50 characters"),

	body("email").trim().isEmail().withMessage("Please provide a valid email").normalizeEmail(),

	body("password")
		.isLength({ min: 8 })
		.withMessage("Password must be at least 8 characters long")
		.matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
		.withMessage("Password must contain uppercase, lowercase, and numeric characters"),

	body("phoneNumber")
		.optional({ nullable: true, checkFalsy: true })
		.trim()
		.custom((value) => {
			// Allow empty string or null
			if (!value || value === "") return true;
			// Basic phone number validation - at least 10 digits
			if (!/^[\+]?[1-9][\d]{0,15}$/.test(value.replace(/[\s\-\(\)]/g, ""))) {
				throw new Error("Please provide a valid phone number");
			}
			return true;
		}),

	body("company")
		.optional()
		.trim()
		.isLength({ max: 100 })
		.withMessage("Company name must not exceed 100 characters"),
];

// Login validation rules
const loginValidation = [
	body("email").trim().isEmail().withMessage("Please provide a valid email").normalizeEmail(),

	body("password").notEmpty().withMessage("Password is required"),
];

// Update profile validation rules
const updateProfileValidation = [
	body("firstName")
		.optional()
		.trim()
		.isLength({ min: 2, max: 50 })
		.withMessage("First name must be between 2-50 characters"),

	body("lastName")
		.optional()
		.trim()
		.isLength({ min: 2, max: 50 })
		.withMessage("Last name must be between 2-50 characters"),

	body("phoneNumber")
		.optional()
		.trim()
		.isMobilePhone()
		.withMessage("Please provide a valid phone number"),

	body("company")
		.optional()
		.trim()
		.isLength({ max: 100 })
		.withMessage("Company name must not exceed 100 characters"),
];

// Change password validation rules
const changePasswordValidation = [
	body("currentPassword").notEmpty().withMessage("Current password is required"),

	body("newPassword")
		.isLength({ min: 8 })
		.withMessage("New password must be at least 8 characters long")
		.matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
		.withMessage("New password must contain uppercase, lowercase, and numeric characters"),
];

// Routes
router.post("/register", registerValidation, validate, register);
router.post("/login", loginValidation, validate, login);
router.get("/profile", authenticateToken, getProfile);
router.put("/profile", authenticateToken, updateProfileValidation, validate, updateProfile);
router.put(
	"/change-password",
	authenticateToken,
	changePasswordValidation,
	validate,
	changePassword
);

// New enhanced auth routes
router.post("/refresh-token", refreshToken);
router.post("/logout", logout);
router.get("/validate-token", authenticateToken, validateToken);

export default router;
