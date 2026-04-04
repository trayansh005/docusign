"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
	Activity,
	MapPin,
	Clock,
	User,
	AlertCircle,
	CheckCircle,
	Eye,
	FileText,
} from "lucide-react";
import { getSignatureTracking } from "@/services/docusignAPI";
import { SigningEvent } from "@/types/docusign";

interface SignatureTrackingProps {
	templateId: string;
	className?: string;
}

export const SignatureTracking: React.FC<SignatureTrackingProps> = ({
	templateId,
	className = "",
}) => {
	const [selectedEvent, setSelectedEvent] = useState<SigningEvent | null>(null);

	const { data, isLoading, error } = useQuery({
		queryKey: ["signature-tracking", templateId],
		queryFn: () => getSignatureTracking(templateId),
		enabled: !!templateId,
	});

	const formatTimestamp = (timestamp: string) => {
		return new Date(timestamp).toLocaleString("en-US", {
			year: "numeric",
			month: "short",
			day: "numeric",
			hour: "2-digit",
			minute: "2-digit",
			second: "2-digit",
		});
	};

	const getEventIcon = (details: string) => {
		if (details.includes("signed")) return <CheckCircle className="h-4 w-4 text-green-500" />;
		if (details.includes("viewed")) return <Eye className="h-4 w-4 text-blue-500" />;
		if (details.includes("created")) return <FileText className="h-4 w-4 text-purple-500" />;
		return <Activity className="h-4 w-4 text-gray-300" />;
	};

	const getEventColor = (details: string) => {
		if (details.includes("signed")) return "border-green-200 bg-green-50";
		if (details.includes("viewed")) return "border-blue-200 bg-blue-50";
		if (details.includes("created")) return "border-purple-200 bg-purple-50";
		return "border-gray-200 bg-gray-50";
	};

	if (isLoading) {
		return (
			<div className={`flex items-center justify-center p-8 ${className}`}>
				<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
				<span className="ml-2 text-gray-600">Loading signature tracking...</span>
			</div>
		);
	}

	if (error) {
		return (
			<div className={`p-8 text-center ${className}`}>
				<AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
				<div className="text-lg font-medium text-red-700 mb-2">Failed to load tracking data</div>
				<div className="text-sm text-gray-600">Please try again later</div>
			</div>
		);
	}

	if (!data || data.signingEvents.length === 0) {
		return (
			<div className={`p-8 text-center ${className}`}>
				<Activity className="h-12 w-12 text-gray-300 mx-auto mb-4" />
				<div className="text-lg font-medium text-gray-900 mb-2">No signature events yet</div>
				<div className="text-sm text-gray-600">
					Events will appear here once the document is viewed or signed
				</div>
			</div>
		);
	}

	return (
		<div className={`space-y-6 ${className}`}>
			{/* Summary */}
			<div className="bg-white border border-gray-200 rounded-lg p-6">
				<h3 className="text-lg font-medium text-gray-900 mb-4">Signature Tracking Summary</h3>
				<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
					<div className="text-center">
						<div className="text-2xl font-bold text-blue-600">{data.totalSigningEvents}</div>
						<div className="text-sm text-gray-600">Total Events</div>
					</div>
					<div className="text-center">
						<div className="text-2xl font-bold text-green-600">
							{data.signingEvents.filter((e) => e.details.includes("signed")).length}
						</div>
						<div className="text-sm text-gray-600">Signatures</div>
					</div>
					<div className="text-center">
						<div className="text-2xl font-bold text-purple-600">
							{data.signingEvents.filter((e) => e.details.includes("viewed")).length}
						</div>
						<div className="text-sm text-gray-600">Views</div>
					</div>
				</div>
			</div>

			{/* Events Timeline */}
			<div className="bg-white border border-gray-200 rounded-lg">
				<div className="p-6 border-b border-gray-200">
					<h3 className="text-lg font-medium text-gray-900">Activity Timeline</h3>
					<p className="text-sm text-gray-600 mt-1">
						Chronological list of all signature-related activities
					</p>
				</div>

				<div className="divide-y divide-gray-200">
					{data.signingEvents.map((event, index) => (
						<div
							key={index}
							className={`p-4 hover:bg-gray-50 cursor-pointer transition-colors ${getEventColor(
								event.details
							)}`}
							onClick={() => setSelectedEvent(event)}
						>
							<div className="flex items-start space-x-3">
								<div className="flex-shrink-0 mt-1">{getEventIcon(event.details)}</div>
								<div className="flex-1 min-w-0">
									<div className="flex items-center justify-between">
										<p className="text-sm font-medium text-gray-900">{event.details}</p>
										<div className="flex items-center text-xs text-gray-200">
											<Clock className="h-3 w-3 mr-1" />
											{formatTimestamp(event.timestamp)}
										</div>
									</div>
									<div className="mt-1 flex items-center space-x-4 text-xs text-gray-600">
										<div className="flex items-center">
											<User className="h-3 w-3 mr-1" />
											{event.userId}
										</div>
										<div className="flex items-center">
											<MapPin className="h-3 w-3 mr-1" />
											{event.location.city}, {event.location.region}, {event.location.country}
										</div>
										<div className="flex items-center">
											<Activity className="h-3 w-3 mr-1" />
											{event.ipAddress}
										</div>
									</div>
								</div>
							</div>
						</div>
					))}
				</div>
			</div>

			{/* Event Details Modal */}
			{selectedEvent && (
				<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
					<div className="bg-white rounded-lg max-w-md w-full mx-4 max-h-[80vh] overflow-y-auto">
						<div className="p-6">
							<div className="flex items-center justify-between mb-4">
								<h3 className="text-lg font-medium text-gray-900">Event Details</h3>
								<button
									onClick={() => setSelectedEvent(null)}
									className="text-gray-300 hover:text-white"
								>
									✕
								</button>
							</div>

							<div className="space-y-4">
								<div>
									<label className="block text-sm font-medium text-gray-700">Activity</label>
									<div className="mt-1 flex items-center space-x-2">
										{getEventIcon(selectedEvent.details)}
										<span className="text-sm text-gray-900">{selectedEvent.details}</span>
									</div>
								</div>

								<div>
									<label className="block text-sm font-medium text-gray-700">Timestamp</label>
									<div className="mt-1 flex items-center space-x-2 text-sm text-gray-600">
										<Clock className="h-4 w-4" />
										{formatTimestamp(selectedEvent.timestamp)}
									</div>
								</div>

								<div>
									<label className="block text-sm font-medium text-gray-700">User</label>
									<div className="mt-1 flex items-center space-x-2 text-sm text-gray-600">
										<User className="h-4 w-4" />
										{selectedEvent.userId}
									</div>
								</div>

								<div>
									<label className="block text-sm font-medium text-gray-700">Location</label>
									<div className="mt-1 flex items-center space-x-2 text-sm text-gray-600">
										<MapPin className="h-4 w-4" />
										<div>
											{selectedEvent.location.city}, {selectedEvent.location.region}
											<br />
											{selectedEvent.location.country}
										</div>
									</div>
								</div>

								<div>
									<label className="block text-sm font-medium text-gray-700">IP Address</label>
									<div className="mt-1 text-sm text-gray-600 font-mono">
										{selectedEvent.ipAddress}
									</div>
								</div>
							</div>
						</div>
					</div>
				</div>
			)}
		</div>
	);
};
