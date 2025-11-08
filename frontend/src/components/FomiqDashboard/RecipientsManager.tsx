"use client";

import { useState } from "react";
import { Recipient } from "./types";
import { UserPicker } from "./UserPicker";
import { X, ChevronUp, ChevronDown } from "lucide-react";
import { getRecipientColor } from "@/constants/recipientColors";

interface RecipientsManagerProps {
	recipients: Recipient[];
	setRecipients: React.Dispatch<React.SetStateAction<Recipient[]>>;
	selectedRecipient?: Recipient | null;
	onRecipientSelect?: (recipient: Recipient | null) => void;
}

export function RecipientsManager({
	recipients,
	setRecipients,
	selectedRecipient,
	onRecipientSelect,
}: RecipientsManagerProps) {
	const [name, setName] = useState("");
	const [email, setEmail] = useState("");
	const [mode, setMode] = useState<"email" | "select">("email");

	const add = () => {
		const n = name.trim();
		const e = email.trim().toLowerCase();
		if (!n) return;
		const exists = recipients.some(
			(r) =>
				r.name.toLowerCase() === n.toLowerCase() || (e && r.email && r.email.toLowerCase() === e)
		);
		if (exists) return; // Prevent duplicate add

		// Assign signing order as next in sequence
		const nextOrder =
			recipients.length > 0 ? Math.max(...recipients.map((r) => r.signingOrder)) + 1 : 1;

		// Assign color based on order
		const color = getRecipientColor(nextOrder - 1);

		setRecipients((r) => [
			...r,
			{
				id: `${Date.now()}-${Math.random()}`,
				name: n,
				email: e || undefined,
				signingOrder: nextOrder,
				color: color.hex,
			},
		]);
		setName("");
		setEmail("");
	};

	const remove = (id: string) => {
		setRecipients((r) => {
			const filtered = r.filter((x) => x.id !== id);
			// Reorder remaining recipients to fill gaps
			return filtered.map((recipient, index) => ({
				...recipient,
				signingOrder: index + 1,
			}));
		});
	};

	const moveUp = (id: string) => {
		setRecipients((r) => {
			const index = r.findIndex((rec) => rec.id === id);
			if (index <= 0) return r; // Already at top

			const newRecipients = [...r];
			// Swap with previous
			[newRecipients[index - 1], newRecipients[index]] = [
				newRecipients[index],
				newRecipients[index - 1],
			];

			// Update signing orders
			return newRecipients.map((recipient, idx) => ({
				...recipient,
				signingOrder: idx + 1,
			}));
		});
	};

	const moveDown = (id: string) => {
		setRecipients((r) => {
			const index = r.findIndex((rec) => rec.id === id);
			if (index < 0 || index >= r.length - 1) return r; // Already at bottom

			const newRecipients = [...r];
			// Swap with next
			[newRecipients[index], newRecipients[index + 1]] = [
				newRecipients[index + 1],
				newRecipients[index],
			];

			// Update signing orders
			return newRecipients.map((recipient, idx) => ({
				...recipient,
				signingOrder: idx + 1,
			}));
		});
	};

	return (
		<div className="p-4 bg-white">
			{/* Tab Buttons */}
			<div className="flex gap-0 mb-4">
				<button
					className={`px-4 py-2 text-sm font-medium transition-colors ${
						mode === "email"
							? "bg-blue-600 text-white"
							: "bg-gray-200 text-gray-700 hover:bg-gray-300"
					} rounded-l-md`}
					onClick={() => setMode("email")}
				>
					Email
				</button>
				<button
					className={`px-4 py-2 text-sm font-medium transition-colors ${
						mode === "select"
							? "bg-blue-600 text-white"
							: "bg-gray-200 text-gray-700 hover:bg-gray-300"
					} rounded-r-md`}
					onClick={() => setMode("select")}
				>
					Select User
				</button>
			</div>

			{/* Input Fields */}
			<div className="space-y-3 mb-4">
				{mode === "email" ? (
					<>
						<input
							className="w-full px-3 py-2.5 rounded-md bg-white text-gray-900 border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none placeholder-gray-400"
							placeholder="Name"
							value={name}
							onChange={(e) => setName(e.target.value)}
							onKeyDown={(e) => e.key === "Enter" && add()}
						/>
						<input
							className="w-full px-3 py-2.5 rounded-md bg-white text-gray-900 border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none placeholder-gray-400"
							placeholder="Email (optional)"
							type="email"
							value={email}
							onChange={(e) => setEmail(e.target.value)}
							onKeyDown={(e) => e.key === "Enter" && add()}
						/>
						<button
							className="w-full px-4 py-2.5 rounded-md bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
							onClick={add}
							disabled={!name.trim()}
						>
							Add Recipient
						</button>
					</>
				) : (
					<UserPicker
						existingRecipients={recipients}
						onSelect={(u) => {
							// Prevent duplicates on selection
							const e = (u.email || "").toLowerCase();
							const exists = recipients.some(
								(r) => r.id === u.id || (e && r.email && r.email.toLowerCase() === e)
							);
							if (exists) return;

							// Assign signing order as next in sequence
							const nextOrder =
								recipients.length > 0 ? Math.max(...recipients.map((r) => r.signingOrder)) + 1 : 1;

							// Assign color based on order
							const color = getRecipientColor(nextOrder - 1);

							setRecipients((r) => [
								...r,
								{
									id: u.id,
									name: u.name,
									email: u.email,
									signingOrder: nextOrder,
									color: color.hex,
								},
							]);
						}}
					/>
				)}
			</div>

			{/* Recipients Count */}
			{recipients.length > 0 && (
				<div className="text-xs text-gray-500 mb-2">
					{recipients.length} {recipients.length === 1 ? "recipient" : "recipients"} added • Click
					to select for field placement
				</div>
			)}

			{/* Recipients List */}
			<ul className="space-y-2">
				{recipients
					.sort((a, b) => a.signingOrder - b.signingOrder)
					.map((r, index) => {
						const isSelected = selectedRecipient?.id === r.id;
						const colorClass = getRecipientColor(r.signingOrder - 1);

						return (
							<li
								key={r.id}
								onClick={() => onRecipientSelect?.(isSelected ? null : r)}
								className={`flex items-center justify-between p-2.5 rounded-md transition-all group cursor-pointer ${
									isSelected
										? `${colorClass.bg} bg-opacity-10 border-2 ${colorClass.border}`
										: "bg-gray-50 border border-gray-200 hover:bg-gray-100"
								}`}
								title={isSelected ? "Click to deselect" : "Click to select for placing fields"}
							>
								<div className="flex items-center gap-2.5 flex-1 min-w-0">
									<div
										className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium text-white flex-shrink-0 ${colorClass.bg}`}
									>
										{r.signingOrder}
									</div>
									<div className="flex-1 min-w-0">
										<div className="font-medium text-gray-900 text-sm truncate">{r.name}</div>
										{r.email && <div className="text-xs text-gray-500 truncate">{r.email}</div>}
									</div>
									{isSelected && (
										<div
											className={`text-xs font-semibold px-2 py-1 rounded ${colorClass.bg} text-white`}
										>
											ACTIVE
										</div>
									)}
								</div>
								<div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
									{/* Reorder buttons */}
									<button
										className="text-gray-400 hover:text-blue-600 transition-colors p-1 disabled:opacity-30 disabled:cursor-not-allowed"
										onClick={() => moveUp(r.id)}
										disabled={index === 0}
										title="Move up in signing order"
									>
										<ChevronUp className="w-4 h-4" />
									</button>
									<button
										className="text-gray-400 hover:text-blue-600 transition-colors p-1 disabled:opacity-30 disabled:cursor-not-allowed"
										onClick={() => moveDown(r.id)}
										disabled={index === recipients.length - 1}
										title="Move down in signing order"
									>
										<ChevronDown className="w-4 h-4" />
									</button>
									<button
										className="text-gray-400 hover:text-red-500 transition-colors p-1 opacity-0 group-hover:opacity-100"
										onClick={() => remove(r.id)}
										title="Remove recipient"
									>
										<X className="w-4 h-4" />
									</button>
								</div>
							</li>
						);
					})}
				{recipients.length === 0 && (
					<li className="text-xs text-gray-400 text-center py-4 italic">No recipients yet</li>
				)}
			</ul>
		</div>
	);
}
