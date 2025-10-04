import mongoose from "mongoose";

export class TemplateValidator {
	/**
	 * Check if a string is a valid MongoDB ObjectId
	 */
	static isValidObjectId(id) {
		return mongoose.Types.ObjectId.isValid(id);
	}

	/**
	 * Build query object for listing templates
	 */
	static buildListQuery(params) {
		const { status, type, createdBy, search } = params;
		const query = { isArchived: false };

		if (status) {
			query.status = status;
		}

		if (type) {
			query.type = type;
		}

		if (createdBy) {
			query.createdBy = createdBy;
		}

		if (search) {
			query.$or = [
				{ name: { $regex: search, $options: "i" } },
				{ "metadata.filename": { $regex: search, $options: "i" } },
			];
		}

		return query;
	}

	/**
	 * Validate template status transition
	 */
	static isValidStatusTransition(currentStatus, newStatus) {
		const validTransitions = {
			draft: ["active", "processing", "failed", "archived"],
			processing: ["draft", "active", "failed"],
			active: ["final", "archived"],
			final: ["archived"],
			failed: ["draft", "processing"],
			archived: [], // Cannot transition from archived
		};

		return validTransitions[currentStatus]?.includes(newStatus) || false;
	}

	/**
	 * Validate template data
	 */
	static validateTemplateData(data) {
		const errors = [];

		if (!data.name || typeof data.name !== "string" || data.name.trim().length === 0) {
			errors.push("Template name is required");
		}

		if (data.type && !["signature", "document", "form"].includes(data.type)) {
			errors.push("Invalid template type");
		}

		if (data.status && !["draft", "active", "final", "archived", "processing", "failed"].includes(data.status)) {
			errors.push("Invalid template status");
		}

		return {
			isValid: errors.length === 0,
			errors,
		};
	}
}
