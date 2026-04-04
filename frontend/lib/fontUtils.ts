/**
 * Font utilities for signature fields
 * Standardizes font sizing calculations across components
 */

export type FieldType = "signature" | "initial" | "date" | "text";

interface FontSizeConfig {
	scaleFactor: number;
	minSize: number;
	maxSize: number;
}

const FONT_SIZE_CONFIGS: Record<FieldType, FontSizeConfig> = {
	signature: {
		scaleFactor: 0.45,
		minSize: 10,
		maxSize: 40,
	},
	initial: {
		scaleFactor: 0.6,
		minSize: 8,
		maxSize: 36,
	},
	date: {
		scaleFactor: 0.35,
		minSize: 8,
		maxSize: 18,
	},
	text: {
		scaleFactor: 0.35,
		minSize: 8,
		maxSize: 20,
	},
};

export const fontUtils = {
	/**
	 * Calculate font size based on field type and height
	 */
	calculateFontSize: (fieldType: FieldType, heightPixels: number): string => {
		const config = FONT_SIZE_CONFIGS[fieldType] || FONT_SIZE_CONFIGS.text;
		const sizeFactor = Math.min(
			Math.max(heightPixels * config.scaleFactor, config.minSize),
			config.maxSize
		);
		return `${Math.round(sizeFactor)}px`;
	},

	/**
	 * Get font weight for field type
	 */
	getFontWeight: (fieldType: FieldType): number => {
		return fieldType === "signature" || fieldType === "initial" ? 400 : 600;
	},

	/**
	 * Get letter spacing for field type
	 */
	getLetterSpacing: (fieldType: FieldType): string => {
		return fieldType === "signature" || fieldType === "initial" ? "0.4px" : "normal";
	},

	/**
	 * Get complete font style object
	 */
	getFontStyle: (
		fieldType: FieldType,
		heightPixels: number,
		fontFamily?: string
	): React.CSSProperties => {
		return {
			fontFamily: fontFamily || "inherit",
			fontSize: fontUtils.calculateFontSize(fieldType, heightPixels),
			fontWeight: fontUtils.getFontWeight(fieldType),
			letterSpacing: fontUtils.getLetterSpacing(fieldType),
			lineHeight: 1.1,
		};
	},
};
