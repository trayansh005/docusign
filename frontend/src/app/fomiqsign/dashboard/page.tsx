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
						Upload PDFs and Word documents, manage templates, apply signatures, and track document
						status.
					</p>
				</div>

				<DashboardClient />
			</div>
		</div>
	);
}
