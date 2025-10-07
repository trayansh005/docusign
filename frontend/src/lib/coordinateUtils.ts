/**
 * Coordinate conversion utilities for signature fields
 * Standardizes between percentage-based and pixel-based coordinate systems
 */

export interface CoordinateRect {
	x: number;
	y: number;
	width: number;
	height: number;
}

export interface PercentageRect {
	xPct: number;
	yPct: number;
	wPct: number;
	hPct: number;
}

export const coordinateUtils = {
	/**
	 * Convert percentage to pixel coordinates
	 */
	pctToPixel: (pct: number, containerSize: number): number => {
		return (pct / 100) * containerSize;
	},

	/**
	 * Convert pixel to percentage coordinates
	 */
	pixelToPct: (pixel: number, containerSize: number): number => {
		if (containerSize === 0) return 0;
		return (pixel / containerSize) * 100;
	},

	/**
	 * Convert percentage-based field to pixel coordinates
	 */
	fieldPctToPixel: (field: PercentageRect, containerRect: DOMRect): CoordinateRect => {
		return {
			x: coordinateUtils.pctToPixel(field.xPct, containerRect.width),
			y: coordinateUtils.pctToPixel(field.yPct, containerRect.height),
			width: coordinateUtils.pctToPixel(field.wPct, containerRect.width),
			height: coordinateUtils.pctToPixel(field.hPct, containerRect.height),
		};
	},

	/**
	 * Convert pixel-based field to percentage coordinates
	 */
	fieldPixelToPct: (field: CoordinateRect, containerRect: DOMRect): PercentageRect => {
		return {
			xPct: coordinateUtils.pixelToPct(field.x, containerRect.width),
			yPct: coordinateUtils.pixelToPct(field.y, containerRect.height),
			wPct: coordinateUtils.pixelToPct(field.width, containerRect.width),
			hPct: coordinateUtils.pixelToPct(field.height, containerRect.height),
		};
	},

	/**
	 * Constrain field position within container bounds
	 */
	constrainFieldPosition: (
		field: PercentageRect,
		deltaXPct: number,
		deltaYPct: number
	): PercentageRect => {
		const maxX = 100 - field.wPct;
		const maxY = 100 - field.hPct;

		return {
			...field,
			xPct: Math.max(0, Math.min(maxX, field.xPct + deltaXPct)),
			yPct: Math.max(0, Math.min(maxY, field.yPct + deltaYPct)),
		};
	},

	/**
	 * Constrain field size within container bounds
	 */
	constrainFieldSize: (
		field: PercentageRect,
		deltaWPct: number,
		deltaHPct: number,
		minWPct: number = 1,
		minHPct: number = 1
	): PercentageRect => {
		const maxW = 100 - field.xPct;
		const maxH = 100 - field.yPct;

		return {
			...field,
			wPct: Math.max(minWPct, Math.min(maxW, field.wPct + deltaWPct)),
			hPct: Math.max(minHPct, Math.min(maxH, field.hPct + deltaHPct)),
		};
	},

	/**
	 * Calculate delta in percentage from pixel movement
	 */
	calculateDeltaPct: (
		startClientX: number,
		startClientY: number,
		currentClientX: number,
		currentClientY: number,
		containerRect: DOMRect
	): { deltaXPct: number; deltaYPct: number } => {
		if (containerRect.width === 0 || containerRect.height === 0) {
			return { deltaXPct: 0, deltaYPct: 0 };
		}

		const deltaX = currentClientX - startClientX;
		const deltaY = currentClientY - startClientY;

		return {
			deltaXPct: coordinateUtils.pixelToPct(deltaX, containerRect.width),
			deltaYPct: coordinateUtils.pixelToPct(deltaY, containerRect.height),
		};
	},

	/**
	 * Validate container rect has valid dimensions
	 */
	isValidContainerRect: (rect: DOMRect | null | undefined): rect is DOMRect => {
		return !!(rect && rect.width > 0 && rect.height > 0);
	},
};
