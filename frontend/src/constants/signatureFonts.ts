/**
 * Signature Font Definitions
 * These fonts are loaded in the root layout.tsx and available as CSS variables
 */

export const SIGNATURE_FONTS = [
	{
		id: "dancing-script",
		name: "Dancing Script",
		fontFamily: "var(--font-dancing-script), 'Dancing Script', cursive",
	},
	{
		id: "great-vibes",
		name: "Great Vibes",
		fontFamily: "var(--font-great-vibes), 'Great Vibes', cursive",
	},
	{
		id: "allura",
		name: "Allura",
		fontFamily: "var(--font-allura), 'Allura', cursive",
	},
	{
		id: "alex-brush",
		name: "Alex Brush",
		fontFamily: "var(--font-alex-brush), 'Alex Brush', cursive",
	},
	{
		id: "amatic-sc",
		name: "Amatic SC",
		fontFamily: "var(--font-amatic-sc), 'Amatic SC', cursive",
	},
	{
		id: "caveat",
		name: "Caveat",
		fontFamily: "var(--font-caveat), 'Caveat', cursive",
	},
	{
		id: "kaushan-script",
		name: "Kaushan Script",
		fontFamily: "var(--font-kaushan-script), 'Kaushan Script', cursive",
	},
	{
		id: "pacifico",
		name: "Pacifico",
		fontFamily: "var(--font-pacifico), 'Pacifico', cursive",
	},
	{
		id: "satisfy",
		name: "Satisfy",
		fontFamily: "var(--font-satisfy), 'Satisfy', cursive",
	},
	{
		id: "permanent-marker",
		name: "Permanent Marker",
		fontFamily: "var(--font-permanent-marker), 'Permanent Marker', cursive",
	},
] as const;

export type SignatureFontId = (typeof SIGNATURE_FONTS)[number]["id"];
