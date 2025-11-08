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
		<div className="space-y-3">
			{/* Search Input */}
			<div className="relative">
				<input
					className="w-full px-3 py-2.5 rounded-md bg-white text-gray-900 border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none placeholder-gray-400"
					placeholder="Search users by name or email..."
					value={q}
					onChange={(e) => setQ(e.target.value)}
				/>
				{loading && (
					<div className="absolute right-3 top-1/2 -translate-y-1/2">
						<div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
					</div>
				)}
			</div>

			{/* User List */}
			<div className="space-y-2 max-h-64 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
				{!loading && users.length === 0 && q.trim() === "" && (
					<div className="text-xs text-gray-400 text-center py-6 italic">
						Start typing to search for users
					</div>
				)}
				{!loading && users.length === 0 && q.trim() !== "" && (
					<div className="text-xs text-gray-400 text-center py-6 italic">
						No users found matching &ldquo;{q}&rdquo;
					</div>
				)}
				{users.map((u) => {
					const isAdded =
						existingIds.has(u.id) || (u.email ? existingEmails.has(u.email.toLowerCase()) : false);
					return (
						<div
							key={u.id}
							className={`flex items-center justify-between p-3 rounded-md border transition-all ${
								isAdded
									? "bg-gray-50 border-gray-200"
									: "bg-white border-gray-200 hover:border-blue-300 hover:shadow-sm"
							}`}
						>
							<div className="flex-1 min-w-0 mr-3">
								<div className="font-medium text-gray-900 text-sm truncate">{u.name}</div>
								{u.email && <div className="text-xs text-gray-500 truncate mt-0.5">{u.email}</div>}
							</div>
							{isAdded ? (
								<span className="px-3 py-1.5 text-xs font-medium rounded-md bg-green-100 text-green-700 border border-green-200 flex-shrink-0">
									✓ Added
								</span>
							) : (
								<button
									className="px-3 py-1.5 text-sm font-medium bg-blue-600 hover:bg-blue-700 rounded-md text-white transition-colors flex-shrink-0"
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
