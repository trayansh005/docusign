import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import DashboardClient from "./DashboardClient";
import { getRecentActivities } from "@/services/activityAPI";

// Mark this page as dynamic since it uses server-side authentication
export const dynamic = "force-dynamic";

export default async function Dashboard() {
	const queryClient = new QueryClient();

	await Promise.all([
		queryClient.prefetchQuery({
			queryKey: ["activities"],
			queryFn: getRecentActivities,
		}),
	]);

	return (
		<HydrationBoundary state={dehydrate(queryClient)}>
			<DashboardClient />
		</HydrationBoundary>
	);
}
