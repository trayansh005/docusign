import { Suspense } from "react";
import ActivityClient from "./ActivityClient";

export const metadata = {
	title: "DocuSign Activity | Document Activity Logs",
	description: "View comprehensive activity logs for all DocuSign operations and document events.",
};

export default async function ActivityPage() {
	return (
		<div className="min-h-screen">
			<div className="container mx-auto px-4 py-8">
				<div className="mb-8">
					<h1 className="text-3xl font-bold text-white mb-2">DocuSign Activity</h1>
					<p className="text-gray-400">
						Comprehensive activity logs for all DocuSign operations, including uploads, signatures, and status changes.
					</p>
				</div>

				<Suspense fallback={<ActivitySkeleton />}>
					<ActivityClient />
				</Suspense>
			</div>
		</div>
	);
}

function ActivitySkeleton() {
	return (
		<div className="space-y-6">
			{/* Filters skeleton */}
			<div className="bg-gray-800/50 rounded-lg p-6">
				<div className="flex gap-4">
					<div className="flex-1 h-10 bg-gray-700 rounded animate-pulse" />
					<div className="w-48 h-10 bg-gray-700 rounded animate-pulse" />
					<div className="w-32 h-10 bg-gray-700 rounded animate-pulse" />
				</div>
			</div>

			{/* Activity list skeleton */}
			<div className="bg-gray-800/50 rounded-lg p-6">
				{Array.from({ length: 5 }).map((_, i) => (
					<div key={i} className="flex items-start gap-4 py-4 border-b border-gray-700 last:border-0">
						<div className="w-10 h-10 bg-gray-700 rounded-full animate-pulse" />
						<div className="flex-1 space-y-2">
							<div className="h-4 bg-gray-700 rounded animate-pulse w-3/4" />
							<div className="h-3 bg-gray-700 rounded animate-pulse w-1/2" />
						</div>
						<div className="h-3 bg-gray-700 rounded animate-pulse w-20" />
					</div>
				))}
			</div>
		</div>
	);
}