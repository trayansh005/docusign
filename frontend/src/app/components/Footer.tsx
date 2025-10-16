import Link from "next/link";

export default function Footer() {
	const currentYear = new Date().getFullYear();

	return (
		<footer className="border-t border-white/10 bg-black/20 backdrop-blur-xl">
			<div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12">
				<div className="grid grid-cols-1 md:grid-cols-4 gap-8">
					{/* Brand Section */}
					<div className="col-span-1 md:col-span-2">
						<Link href="/" className="flex items-center space-x-3 mb-4">
							<div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-lg flex items-center justify-center">
								<svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
									<path
										fillRule="evenodd"
										d="M4 4a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2H4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z"
										clipRule="evenodd"
									/>
								</svg>
							</div>
							<span className="text-xl font-bold text-gradient">FomiqSign Platform</span>
						</Link>
						<p className="text-slate-300 max-w-md leading-relaxed">
							Secure, modern platform for digital document signing and subscription management.
							Built with cutting-edge technology for seamless user experience.
						</p>
						<div className="flex items-center space-x-4 mt-6">
							<a
								href="#"
								className="text-slate-300 hover:text-blue-400 transition-colors duration-200"
							>
								<svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
									<path
										fillRule="evenodd"
										d="M20 10c0-5.523-4.477-10-10-10S0 4.477 0 10c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V10h2.54V7.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V10h2.773l-.443 2.89h-2.33v6.988C16.343 19.128 20 14.991 20 10z"
										clipRule="evenodd"
									/>
								</svg>
							</a>
							<a
								href="#"
								className="text-slate-300 hover:text-blue-400 transition-colors duration-200"
							>
								<svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
									<path d="M6.29 18.251c7.547 0 11.675-6.253 11.675-11.675 0-.178 0-.355-.012-.53A8.348 8.348 0 0020 3.92a8.19 8.19 0 01-2.357.646 4.118 4.118 0 001.804-2.27 8.224 8.224 0 01-2.605.996 4.107 4.107 0 00-6.993 3.743 11.65 11.65 0 01-8.457-4.287 4.106 4.106 0 001.27 5.477A4.073 4.073 0 01.8 7.713v.052a4.105 4.105 0 003.292 4.022 4.095 4.095 0 01-1.853.07 4.108 4.108 0 003.834 2.85A8.233 8.233 0 010 16.407a11.616 11.616 0 006.29 1.84" />
								</svg>
							</a>
							<a
								href="#"
								className="text-slate-300 hover:text-blue-400 transition-colors duration-200"
							>
								<svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
									<path
										fillRule="evenodd"
										d="M16.338 16.338H13.67V12.16c0-.995-.017-2.277-1.387-2.277-1.39 0-1.601 1.086-1.601 2.207v4.248H8.014v-8.59h2.559v1.174h.037c.356-.675 1.227-1.387 2.526-1.387 2.703 0 3.203 1.778 3.203 4.092v4.711zM5.005 6.575a1.548 1.548 0 11-.003-3.096 1.548 1.548 0 01.003 3.096zm-1.337 9.763H6.34v-8.59H3.667v8.59zM17.668 1H2.328C1.595 1 1 1.581 1 2.298v15.403C1 18.418 1.595 19 2.328 19h15.34c.734 0 1.332-.582 1.332-1.299V2.298C19 1.581 18.402 1 17.668 1z"
										clipRule="evenodd"
									/>
								</svg>
							</a>
						</div>
					</div>

					{/* Quick Links */}
					<div>
						<h3 className="text-white font-semibold mb-4">Platform</h3>
						<ul className="space-y-3">
							<li>
								<Link
									href="/fomiqsign/dashboard"
									className="text-slate-300 hover:text-white transition-colors duration-200"
								>
									Sign Documents
								</Link>
							</li>
							<li>
								<Link
									href="/subscription"
									className="text-slate-300 hover:text-white transition-colors duration-200"
								>
									Pricing Plans
								</Link>
							</li>
							<li>
								<Link
									href="/login"
									className="text-slate-300 hover:text-white transition-colors duration-200"
								>
									Sign In
								</Link>
							</li>
							<li>
								<Link
									href="/register"
									className="text-slate-300 hover:text-white transition-colors duration-200"
								>
									Create Account
								</Link>
							</li>
						</ul>
					</div>

					{/* Support */}
					<div>
						<h3 className="text-white font-semibold mb-4">Support</h3>
						<ul className="space-y-3">
							<li>
								<a
									href="#"
									className="text-slate-300 hover:text-white transition-colors duration-200"
								>
									Help Center
								</a>
							</li>
							<li>
								<a
									href="#"
									className="text-slate-300 hover:text-white transition-colors duration-200"
								>
									Privacy Policy
								</a>
							</li>
							<li>
								<Link
									href="/terms-of-service"
									className="text-slate-300 hover:text-white transition-colors duration-200"
								>
									Terms of Service
								</Link>
							</li>
							<li>
								<Link
									href="/contact"
									className="text-slate-300 hover:text-white transition-colors duration-200"
								>
									Contact Us
								</Link>
							</li>
						</ul>
					</div>
				</div>

				{/* Bottom Section */}
				<div className="mt-12 pt-8 border-t border-white/10 flex flex-col md:flex-row justify-between items-center">
					<p className="text-slate-300 text-sm">
						© {currentYear} FomiqSign Platform. Built with modern technology for secure document
						management.
					</p>
					<div className="flex items-center space-x-6 mt-4 md:mt-0">
						<span className="text-slate-300 text-sm">Maintained by</span>
						<div className="flex items-center space-x-2">
							<span className="text-blue-400 font-semibold text-sm">RSSC Technologies</span>
						</div>
					</div>
				</div>
			</div>
		</footer>
	);
}
