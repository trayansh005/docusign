// Color palette for recipients - vibrant, distinct colors
export const RECIPIENT_COLORS = [
	{ bg: "bg-blue-500", border: "border-blue-500", text: "text-blue-500", hex: "#3B82F6" },
	{ bg: "bg-green-500", border: "border-green-500", text: "text-green-500", hex: "#10B981" },
	{ bg: "bg-purple-500", border: "border-purple-500", text: "text-purple-500", hex: "#8B5CF6" },
	{ bg: "bg-orange-500", border: "border-orange-500", text: "text-orange-500", hex: "#F97316" },
	{ bg: "bg-pink-500", border: "border-pink-500", text: "text-pink-500", hex: "#EC4899" },
	{ bg: "bg-teal-500", border: "border-teal-500", text: "text-teal-500", hex: "#14B8A6" },
	{ bg: "bg-red-500", border: "border-red-500", text: "text-red-500", hex: "#EF4444" },
	{ bg: "bg-indigo-500", border: "border-indigo-500", text: "text-indigo-500", hex: "#6366F1" },
	{ bg: "bg-yellow-500", border: "border-yellow-500", text: "text-yellow-500", hex: "#EAB308" },
	{ bg: "bg-cyan-500", border: "border-cyan-500", text: "text-cyan-500", hex: "#06B6D4" },
];

export function getRecipientColor(index: number) {
	return RECIPIENT_COLORS[index % RECIPIENT_COLORS.length];
}
