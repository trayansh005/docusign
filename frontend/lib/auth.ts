import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:5002/api").replace(/\/$/, "");

export interface ServerUser {
	id: string;
	firstName: string;
	lastName: string;
	email: string;
	role: "user" | "admin" | "superadmin";
	isAdmin: boolean;
	avatarUrl?: string;
  company?: string;
}

export async function getServerSession(): Promise<ServerUser | null> {
	try {
		const cookieStore = await cookies();
		const token = cookieStore.get("accessToken")?.value;
		if (!token) return null;

		const res = await fetch(`${API_BASE_URL}/auth/profile`, {
			headers: { Authorization: `Bearer ${token}` },
			cache: "no-store",
		});

		if (!res.ok) return null;

		const data = await res.json();
		const u = data?.data?.user || data?.user;
		if (!u?.id && !u?._id) return null;

		return {
			id: u.id || u._id,
			firstName: u.firstName || "",
			lastName: u.lastName || "",
			email: u.email,
			role: u.role || "user",
			isAdmin: Boolean(u.isAdmin || u.role === "admin" || u.role === "superadmin"),
			avatarUrl: u.avatarUrl,
      company: u.company
		};
	} catch {
		return null;
	}
}

export async function requireAuth(): Promise<ServerUser> {
	const user = await getServerSession();
	if (!user) redirect("/login");
	return user;
}

export async function requireAdmin(): Promise<ServerUser> {
	const user = await getServerSession();
	if (!user || !user.isAdmin) redirect("/");
	return user;
}
