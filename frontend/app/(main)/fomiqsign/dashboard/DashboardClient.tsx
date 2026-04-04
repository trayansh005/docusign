"use client";

import { DashboardClient } from "@/components/FomiqDashboard";

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
interface DashboardClientProps { }

export default function DashboardClientWrapper({ }: DashboardClientProps) {
	return <DashboardClient />;
}