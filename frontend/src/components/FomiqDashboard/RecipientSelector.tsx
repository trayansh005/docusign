"use client";

import { Recipient } from "./types";
import { X } from "lucide-react";

interface RecipientSelectorProps {
	recipients: Recipient[];
	fieldType: string;
	onSelect: (recipient: Recipient) => void;
	onCancel: () => void;
}

export function RecipientSelector({
	recipients,
	fieldType,
	onSelect,
	onCancel,
}: RecipientSelectorProps) {
	if (recipients.length === 0) {
		return (
			<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
				<div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
					<div className="flex items-center justify-between p-4 border-b border-gray-200">
						<h3 className="text-lg font-semibold text-gray-900">No Recipients Added</h3>
						<button
							onClick={onCancel}
							className="text-gray-400 hover:text-gray-600 transition-colors"
						>
							<X className="w-5 h-5" />
						</button>
					</div>
					<div className="p-6 text-center">
						<p className="text-gray-600 mb-4">
							Please add recipients first before placing fields for them.
						</p>
						<button
							onClick={onCancel}
							className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors"
						>
							Close
						</button>
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
			<div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
				<div className="flex items-center justify-between p-4 border-b border-gray-200">
					<h3 className="text-lg font-semibold text-gray-900">Select Recipient for {fieldType}</h3>
					<button
						onClick={onCancel}
						className="text-gray-400 hover:text-gray-600 transition-colors"
					>
						<X className="w-5 h-5" />
					</button>
				</div>
				<div className="p-4">
					<p className="text-sm text-gray-600 mb-4">
						Choose which recipient should fill this field:
					</p>
					<div className="space-y-2 max-h-96 overflow-y-auto">
						{recipients
							.sort((a, b) => a.signingOrder - b.signingOrder)
							.map((recipient) => (
								<button
									key={recipient.id}
									onClick={() => onSelect(recipient)}
									className="w-full flex items-center gap-3 p-3 text-left rounded-lg border border-gray-200 hover:border-blue-500 hover:bg-blue-50 transition-all group"
								>
									<div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-sm font-medium text-white flex-shrink-0">
										{recipient.signingOrder}
									</div>
									<div className="flex-1 min-w-0">
										<div className="font-medium text-gray-900 truncate">{recipient.name}</div>
										{recipient.email && (
											<div className="text-xs text-gray-500 truncate">{recipient.email}</div>
										)}
									</div>
									<div className="text-xs text-gray-400 group-hover:text-blue-600">Select →</div>
								</button>
							))}
					</div>
				</div>
				<div className="p-4 border-t border-gray-200 bg-gray-50">
					<button
						onClick={onCancel}
						className="w-full px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-md transition-colors"
					>
						Cancel
					</button>
				</div>
			</div>
		</div>
	);
}
