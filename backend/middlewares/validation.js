import { validationResult } from "express-validator";

// Validation middleware
export const validate = (req, res, next) => {
	const errors = validationResult(req);

	if (!errors.isEmpty()) {
		console.log("Validation errors:", errors.array());
		return res.status(400).json({
			success: false,
			message: "Validation failed",
			errors: errors.array().map((error) => ({
				field: error.path,
				message: error.msg,
				value: error.value,
			})),
		});
	}

	next();
};

// Custom validation helpers
export const customValidations = {
	isValidEmail: (email) => {
		const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
		return emailRegex.test(email);
	},

	isStrongPassword: (password) => {
		// At least 8 characters, 1 uppercase, 1 lowercase, 1 number
		const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]{8,}$/;
		return passwordRegex.test(password);
	},

	isValidName: (name) => {
		return typeof name === "string" && name.trim().length >= 2 && name.trim().length <= 50;
	},
};
