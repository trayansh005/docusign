import { Suspense } from "react";
import DashboardClient from "./DashboardClient";

export const metadata = {
	title: "FomiqSign Dashboard | Secure Document Signing",
	description: "Manage your FomiqSign templates, apply signatures, and track document status.",
};

// Mark as dynamic to prevent SSR issues with PDF rendering
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
	return (
		<div className="min-h-screen">
			<div className="container mx-auto px-4 py-8">
				<div className="mb-8">
					<h1 className="text-3xl font-bold text-white mb-2">FomiqSign Dashboard</h1>
					<p className="text-gray-400">
						Upload PDFs, manage templates, apply signatures, and track document status.
					</p>
				</div>

				<Suspense fallback={<DashboardSkeleton />}>
					<DashboardClient />
				</Suspense>
			</div>
		</div>
	);
}

function DashboardSkeleton() {
	return (
		<div className="space-y-6">
			{/* Tabs skeleton */}
			<div className="flex space-x-1 bg-gray-800/50 p-1 rounded-lg">
				{Array.from({ length: 7 }).map((_, i) => (
					<div key={i} className="flex-1 h-10 bg-gray-700 rounded animate-pulse" />
				))}
			</div>

			{/* Content skeleton */}
			<div className="bg-gray-800/50 rounded-lg p-6">
				<div className="h-64 bg-gray-700 rounded animate-pulse" />
			</div>
		</div>
	);
}
