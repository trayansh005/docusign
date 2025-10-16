"use client";

import { useState } from "react";
import { Recipient } from "./types";
import { UserPicker } from "./UserPicker";

interface RecipientsManagerProps {
	recipients: Recipient[];
	setRecipients: React.Dispatch<React.SetStateAction<Recipient[]>>;
}

export function RecipientsManager({ recipients, setRecipients }: RecipientsManagerProps) {
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
		setRecipients((r) => [
			...r,
			{ id: `${Date.now()}-${Math.random()}`, name: n, email: e || undefined },
		]);
		setName("");
		setEmail("");
	};

	const remove = (id: string) => setRecipients((r) => r.filter((x) => x.id !== id));

	return (
		<div>
			<div className="flex gap-2 mb-3">
				<button
					className={`px-2 py-1 rounded-md ${
						mode === "email" ? "bg-blue-600 text-white" : "bg-gray-700 text-gray-200"
					}`}
					onClick={() => setMode("email")}
				>
					Email
				</button>
				<button
					className={`px-2 py-1 rounded-md ${
						mode === "select" ? "bg-blue-600 text-white" : "bg-gray-700 text-gray-200"
					}`}
					onClick={() => setMode("select")}
				>
					Select User
				</button>
			</div>
			<div className="space-y-3">
				{mode === "email" ? (
					<>
						<input
							className="w-full px-3 py-2 rounded-md bg-gray-800 text-gray-100 border border-gray-700"
							placeholder="Name"
							value={name}
							onChange={(e) => setName(e.target.value)}
						/>
						<input
							className="w-full px-3 py-2 rounded-md bg-gray-800 text-gray-100 border border-gray-700"
							placeholder="Email (optional)"
							value={email}
							onChange={(e) => setEmail(e.target.value)}
						/>
						<div className="flex gap-2">
							<button
								className="px-3 py-2 rounded-md bg-blue-600 hover:bg-blue-700 text-white font-medium"
								onClick={add}
							>
								Add Recipient
							</button>
						</div>
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
							setRecipients((r) => [...r, { id: u.id, name: u.name, email: u.email }]);
						}}
					/>
				)}
			</div>
			<ul className="mt-3 space-y-2 text-sm">
				{recipients.map((r) => (
					<li key={r.id} className="flex justify-between items-center">
						<div>
							<div className="font-medium text-gray-100">{r.name}</div>
							{r.email && <div className="text-xs text-gray-400">{r.email}</div>}
						</div>
						<button className="text-sm text-red-400" onClick={() => remove(r.id)}>
							Remove
						</button>
					</li>
				))}
				{recipients.length === 0 && <li className="text-xs text-gray-400">No recipients yet</li>}
			</ul>
		</div>
	);
}
