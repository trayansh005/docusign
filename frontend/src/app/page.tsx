import Link from "next/link";

export default function Home() {
	return (
		<div className="min-h-screen">
			{/* Hero Section */}
			<section className="relative overflow-hidden py-20 sm:py-32">
				<div className="container mx-auto px-4 sm:px-6 lg:px-8">
					<div className="text-center">
						<h1 className="text-4xl sm:text-6xl lg:text-7xl font-bold tracking-tight mb-8 fade-in">
							Secure Digital
							<br />
							<span className="text-gradient-blue">Document Signing</span>
						</h1>
						<p className="max-w-3xl mx-auto text-xl text-slate-300 leading-relaxed mb-12 slide-up">
							Experience the future of document management with our secure, fast, and intuitive
							platform. Sign documents digitally, manage subscriptions, and streamline your workflow
							with cutting-edge technology.
						</p>

						<div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-16">
							<Link href="/register" className="btn btn-primary px-8 py-4 text-lg glow">
								Get Started
							</Link>
							<Link href="/fomiqsign/dashboard" className="btn btn-outline px-8 py-4 text-lg">
								Sign Document
							</Link>
						</div>

						{/* Stats */}
						<div className="grid grid-cols-2 md:grid-cols-4 gap-8 max-w-4xl mx-auto">
							<div className="text-center">
								<div className="text-3xl font-bold text-gradient mb-2">99.9%</div>
								<div className="text-slate-300 text-sm">Uptime</div>
							</div>
							<div className="text-center">
								<div className="text-3xl font-bold text-gradient mb-2">10M+</div>
								<div className="text-slate-300 text-sm">Documents Signed</div>
							</div>
							<div className="text-center">
								<div className="text-3xl font-bold text-gradient mb-2">256-bit</div>
								<div className="text-slate-300 text-sm">Encryption</div>
							</div>
							<div className="text-center">
								<div className="text-3xl font-bold text-gradient mb-2">24/7</div>
								<div className="text-slate-300 text-sm">Support</div>
							</div>
						</div>
					</div>
				</div>
			</section>

			{/* Features Section */}
			<section className="py-24 relative">
				<div className="container mx-auto px-4 sm:px-6 lg:px-8">
					<div className="text-center mb-16">
						<h2 className="text-3xl sm:text-4xl font-bold mb-4 text-white">
							Powerful Features for Modern Workflows
						</h2>
						<p className="text-slate-300 max-w-2xl mx-auto">
							Everything you need to manage documents and subscriptions in one platform
						</p>
					</div>

					<div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
						<div className="card card-hover">
							<div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-lg flex items-center justify-center mb-4">
								<svg
									className="w-6 h-6 text-white"
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24"
								>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={2}
										d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
									/>
								</svg>
							</div>
							<h3 className="text-xl font-semibold mb-3 text-white">Secure Signatures</h3>
							<p className="text-slate-300">
								Industry-leading security with 256-bit encryption and legally binding digital
								signatures.
							</p>
						</div>

						<div className="card card-hover">
							<div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center mb-4">
								<svg
									className="w-6 h-6 text-white"
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24"
								>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={2}
										d="M13 10V3L4 14h7v7l9-11h-7z"
									/>
								</svg>
							</div>
							<h3 className="text-xl font-semibold mb-3 text-white">Lightning Fast</h3>
							<p className="text-slate-300">
								Sign documents in seconds with our optimized platform built for speed and
								reliability.
							</p>
						</div>

						<div className="card card-hover">
							<div className="w-12 h-12 bg-gradient-to-br from-green-500 to-teal-500 rounded-lg flex items-center justify-center mb-4">
								<svg
									className="w-6 h-6 text-white"
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24"
								>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={2}
										d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1"
									/>
								</svg>
							</div>
							<h3 className="text-xl font-semibold mb-3 text-white">Flexible Plans</h3>
							<p className="text-slate-300">
								Choose from various subscription plans that scale with your business needs.
							</p>
						</div>

						<div className="card card-hover">
							<div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-red-500 rounded-lg flex items-center justify-center mb-4">
								<svg
									className="w-6 h-6 text-white"
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24"
								>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={2}
										d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
									/>
								</svg>
							</div>
							<h3 className="text-xl font-semibold mb-3 text-white">Analytics</h3>
							<p className="text-slate-300">
								Track document status, signing progress, and get insights into your workflow.
							</p>
						</div>

						<div className="card card-hover">
							<div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-blue-500 rounded-lg flex items-center justify-center mb-4">
								<svg
									className="w-6 h-6 text-white"
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24"
								>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={2}
										d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
									/>
								</svg>
							</div>
							<h3 className="text-xl font-semibold mb-3 text-white">Team Collaboration</h3>
							<p className="text-slate-300">
								Seamlessly collaborate with team members and manage permissions efficiently.
							</p>
						</div>

						<div className="card card-hover">
							<div className="w-12 h-12 bg-gradient-to-br from-pink-500 to-rose-500 rounded-lg flex items-center justify-center mb-4">
								<svg
									className="w-6 h-6 text-white"
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24"
								>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={2}
										d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
									/>
								</svg>
							</div>
							<h3 className="text-xl font-semibold mb-3 text-white">24/7 Support</h3>
							<p className="text-slate-300">
								Get help whenever you need it with our dedicated support team available around the
								clock.
							</p>
						</div>
					</div>
				</div>
			</section>

			{/* CTA Section */}
			<section className="py-24 relative">
				<div className="container mx-auto px-4 sm:px-6 lg:px-8">
					<div className="max-w-4xl mx-auto text-center glass rounded-2xl p-12">
						<h2 className="text-3xl sm:text-4xl font-bold mb-6 text-white">
							Ready to Transform Your Workflow?
						</h2>
						<p className="text-xl text-slate-300 mb-8 max-w-2xl mx-auto">
							Join thousands of businesses that trust our platform for secure document signing and
							management.
						</p>
						<div className="flex flex-col sm:flex-row gap-4 justify-center">
							<Link href="/register" className="btn btn-primary px-8 py-4 text-lg">
								Get Started
							</Link>
							<Link href="/subscription" className="btn btn-secondary px-8 py-4 text-lg">
								View Pricing
							</Link>
						</div>
					</div>
				</div>
			</section>
		</div>
	);
}
