import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import HomeClient from "./HomeClient";
import { getRecentActivities } from "@/services/activityAPI";

export default async function Home() {
	const queryClient = new QueryClient();

	await Promise.all([
		queryClient.prefetchQuery({
			queryKey: ["activities"],
			queryFn: getRecentActivities,
		}),
	]);

	return (
		<HydrationBoundary state={dehydrate(queryClient)}>
			<HomeClient />
		</HydrationBoundary>
	);
}
