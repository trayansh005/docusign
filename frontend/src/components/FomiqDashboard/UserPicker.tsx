"use client";

import { useEffect, useMemo, useState } from "react";
import apiClient from "@/lib/apiClient";
import { Recipient } from "./types";

interface UserOption {
	id: string;
	name: string;
	email?: string;
}

interface UserPickerProps {
	onSelect: (user: UserOption) => void;
	existingRecipients?: Recipient[];
}

export function UserPicker({ onSelect, existingRecipients = [] }: UserPickerProps) {
	const [q, setQ] = useState("");
	const [users, setUsers] = useState<UserOption[]>([]);
	const [loading, setLoading] = useState(false);

	// Build quick-lookup sets for existing recipients
	const existingIds = useMemo(
		() => new Set(existingRecipients.map((r) => r.id)),
		[existingRecipients]
	);
	const existingEmails = useMemo(
		() =>
			new Set(
				existingRecipients.map((r) => (r.email ? r.email.toLowerCase() : "")).filter(Boolean)
			),
		[existingRecipients]
	);

	useEffect(() => {
		const load = async () => {
			setLoading(true);
			try {
				const res = await apiClient.get<{ success?: boolean; data?: UserOption[] }>(
					`/users?q=${encodeURIComponent(q)}`
				);
				if (res && res.success && Array.isArray(res.data)) setUsers(res.data);
			} catch (e) {
				console.error("Failed to load users", e);
			} finally {
				setLoading(false);
			}
		};
		load();
	}, [q]);

	return (
		<div>
			<input
				className="w-full px-3 py-2 rounded-md bg-gray-800 text-gray-100 border border-gray-700 mb-2"
				placeholder="Search users by name or email"
				value={q}
				onChange={(e) => setQ(e.target.value)}
			/>
			<div className="space-y-2 max-h-48 overflow-auto">
				{loading && <div className="text-xs text-gray-400">Loading...</div>}
				{!loading && users.length === 0 && (
					<div className="text-xs text-gray-400">No users found</div>
				)}
				{users.map((u) => {
					const isAdded =
						existingIds.has(u.id) || (u.email ? existingEmails.has(u.email.toLowerCase()) : false);
					return (
						<div key={u.id} className="flex items-center justify-between">
							<div>
								<div className="font-medium text-gray-100">{u.name}</div>
								<div className="text-xs text-gray-400">{u.email}</div>
							</div>
							{isAdded ? (
								<span className="px-2 py-1 text-xs rounded-md bg-gray-700 text-gray-300">
									Added
								</span>
							) : (
								<button
									className="px-2 py-1 text-sm bg-blue-600 rounded-md text-white"
									onClick={() => onSelect(u)}
								>
									Add
								</button>
							)}
						</div>
					);
				})}
			</div>
		</div>
	);
}
