import Link from "next/link";
import Image from "next/image";
import { getUser } from "@/lib/getUser";
import { PendingDocumentsNotification } from "@/components/PendingDocumentsNotification";
import HeaderAuthButtons from "./HeaderAuthButtons";

// Server component — fetches user directly, no client store needed.
export default async function Header() {
	const user = await getUser();

	return (
		<header className="sticky top-0 z-50 w-full border-b border-white/10 bg-black/20 backdrop-blur-xl">
			<div className="container mx-auto px-4 sm:px-6 lg:px-8">
				<div className="flex h-16 items-center justify-between">
					{/* Logo */}
					<Link
						href="/"
						className="flex items-center space-x-3 text-xl font-bold text-white hover:text-blue-400 transition-colors duration-200"
					>
						<Image
							src="/logo.png"
							alt="FomiqSign Platform"
							width={150}
							height={40}
							className="h-32 w-auto object-contain"
						/>
					</Link>

					{/* Nav — client component handles logout button interactivity */}
					<HeaderAuthButtons user={user} />
				</div>
			</div>
		</header>
	);
}
