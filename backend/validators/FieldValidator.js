import { v4 as uuidv4 } from "uuid";

export class FieldValidator {
	/**
	 * Validate signature field type
	 */
	static isValidFieldType(type) {
		return ["signature", "date", "initial", "text"].includes(type);
	}

	/**
	 * Normalize field coordinates from pixels to percentages
	 */
	static normalizeCoordinates(field, viewport) {
		const { x, y, width, height, pageNumber } = field;

		if (!viewport || !viewport[pageNumber]) {
			// If no viewport info, store pixel coordinates only
			return {
				...field,
				x,
				y,
				width,
				height,
			};
		}

		const { width: viewportWidth, height: viewportHeight } = viewport[pageNumber];

		return {
			...field,
			x,
			y,
			width,
			height,
			xPct: x / viewportWidth,
			yPct: y / viewportHeight,
			wPct: width / viewportWidth,
			hPct: height / viewportHeight,
		};
	}

	/**
	 * Process bulk fields with normalization
	 */
	static processBulkFields(fields, viewport, pages) {
		return fields.map((field) => {
			// Ensure field has an ID
			if (!field.id) {
				field.id = uuidv4();
			}

			// Normalize coordinates if viewport provided
			if (viewport) {
				return this.normalizeCoordinates(field, viewport);
			}

			return field;
		});
	}

	/**
	 * Validate field data
	 */
	static validateField(field) {
		const errors = [];

		if (!field.id) {
			errors.push("Field ID is required");
		}

		if (!field.recipientId) {
			errors.push("Recipient ID is required");
		}

		if (!this.isValidFieldType(field.type)) {
			errors.push("Invalid field type");
		}

		if (field.pageNumber < 1) {
			errors.push("Invalid page number");
		}

		// Validate coordinates
		if (field.xPct !== undefined) {
			if (field.xPct < 0 || field.xPct > 1) {
				errors.push("xPct must be between 0 and 1");
			}
		}

		if (field.yPct !== undefined) {
			if (field.yPct < 0 || field.yPct > 1) {
				errors.push("yPct must be between 0 and 1");
			}
		}

		if (field.wPct !== undefined) {
			if (field.wPct < 0 || field.wPct > 1) {
				errors.push("wPct must be between 0 and 1");
			}
		}

		if (field.hPct !== undefined) {
			if (field.hPct < 0 || field.hPct > 1) {
				errors.push("hPct must be between 0 and 1");
			}
		}

		return {
			isValid: errors.length === 0,
			errors,
		};
	}

	/**
	 * Validate bulk fields
	 */
	static validateBulkFields(fields) {
		const allErrors = [];

		fields.forEach((field, index) => {
			const { isValid, errors } = this.validateField(field);
			if (!isValid) {
				allErrors.push({
					fieldIndex: index,
					fieldId: field.id,
					errors,
				});
			}
		});

		return {
			isValid: allErrors.length === 0,
			errors: allErrors,
		};
	}
}
