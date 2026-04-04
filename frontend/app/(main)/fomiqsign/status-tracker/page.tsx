import { Suspense } from "react";
import StatusTrackerClient from "./StatusTrackerClient";

export const metadata = {
	title: "FomiqSign Status Tracker | Document Status Monitoring",
	description: "Monitor document status, view audit trails, and access signed documents.",
};

export default async function StatusTrackerPage() {
	return (
		<div className="min-h-screen">
			<div className="container mx-auto px-4 py-8">
				<div className="mb-8">
					<h1 className="text-3xl font-bold text-white mb-2">Document Status Tracker</h1>
					<p className="text-gray-200">
						Monitor document status, view processing history, and access completed signed documents.
					</p>
				</div>

				<Suspense fallback={<StatusTrackerSkeleton />}>
					<StatusTrackerClient />
				</Suspense>
			</div>
		</div>
	);
}

function StatusTrackerSkeleton() {
	return (
		<div className="space-y-6">
			{/* Status filters skeleton */}
			<div className="bg-gray-800/50 rounded-lg p-6">
				<div className="flex gap-2">
					{Array.from({ length: 6 }).map((_, i) => (
						<div key={i} className="px-4 py-2 bg-gray-700 rounded-lg animate-pulse w-20 h-8" />
					))}
				</div>
			</div>

			{/* Documents list skeleton */}
			<div className="bg-gray-800/50 rounded-lg p-6">
				{Array.from({ length: 4 }).map((_, i) => (
					<div key={i} className="flex items-center justify-between py-4 border-b border-gray-700 last:border-0">
						<div className="flex items-center gap-4">
							<div className="w-10 h-10 bg-gray-700 rounded animate-pulse" />
							<div className="space-y-2">
								<div className="h-4 bg-gray-700 rounded animate-pulse w-48" />
								<div className="h-3 bg-gray-700 rounded animate-pulse w-32" />
							</div>
						</div>
						<div className="flex items-center gap-2">
							<div className="w-20 h-6 bg-gray-700 rounded animate-pulse" />
							<div className="w-8 h-8 bg-gray-700 rounded animate-pulse" />
						</div>
					</div>
				))}
			</div>
		</div>
	);
}