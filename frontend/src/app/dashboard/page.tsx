import DashboardClient from "./DashboardClient";

// Mark this page as dynamic since it uses authentication
export const dynamic = "force-dynamic";

export default function Dashboard() {
	// Middleware handles auth check and redirect
	// Client component handles all data fetching
	return <DashboardClient />;
}
