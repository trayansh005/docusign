import React from "react";

export default function TermsOfServicePage() {
	return (
		<div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8">
			<div className="max-w-4xl mx-auto bg-gray-800/50 backdrop-blur-xl rounded-lg p-8 md:p-12">
				<h1 className="text-4xl font-bold text-white mb-8">Terms of Service</h1>

				<div className="prose prose-gray max-w-none">
					<p className="text-sm text-gray-400 mb-8">
						Last Updated:{" "}
						{new Date().toLocaleDateString("en-US", {
							year: "numeric",
							month: "long",
							day: "numeric",
						})}
					</p>

					<section className="mb-8">
						<h2 className="text-2xl font-semibold text-white mb-4">1. Acceptance of Terms</h2>
						<p className="text-gray-300 leading-relaxed mb-4">
							By accessing and using FomiqSign, you accept and agree to be bound by the terms and
							provision of this agreement. If you do not agree to abide by the above, please do not
							use this service.
						</p>
					</section>

					<section className="mb-8">
						<h2 className="text-2xl font-semibold text-white mb-4">2. Use License</h2>
						<p className="text-gray-300 leading-relaxed mb-4">
							Permission is granted to temporarily access and use FomiqSign for personal or
							commercial purposes. This is the grant of a license, not a transfer of title, and
							under this license you may not:
						</p>
						<ul className="list-disc pl-6 text-gray-300 space-y-2 mb-4">
							<li>Modify or copy the materials</li>
							<li>Use the materials for any commercial purpose without authorization</li>
							<li>Attempt to decompile or reverse engineer any software contained on FomiqSign</li>
							<li>Remove any copyright or other proprietary notations from the materials</li>
							<li>
								Transfer the materials to another person or \u0022mirror\u0022 the materials on any
								other server
							</li>
						</ul>
					</section>

					<section className="mb-8">
						<h2 className="text-2xl font-semibold text-white mb-4">3. User Accounts</h2>
						<p className="text-gray-300 leading-relaxed mb-4">
							When you create an account with us, you must provide accurate, complete, and current
							information. Failure to do so constitutes a breach of the Terms, which may result in
							immediate termination of your account.
						</p>
						<p className="text-gray-300 leading-relaxed mb-4">
							You are responsible for safeguarding the password and for all activities that occur
							under your account. You agree not to disclose your password to any third party and to
							notify us immediately upon becoming aware of any breach of security.
						</p>
					</section>

					<section className="mb-8">
						<h2 className="text-2xl font-semibold text-white mb-4">4. Electronic Signatures</h2>
						<p className="text-gray-300 leading-relaxed mb-4">
							FomiqSign provides electronic signature services. By using our service, you
							acknowledge that:
						</p>
						<ul className="list-disc pl-6 text-gray-300 space-y-2 mb-4">
							<li>Electronic signatures created through our platform are legally binding</li>
							<li>
								You have the authority to sign documents on behalf of yourself or your organization
							</li>
							<li>You consent to conduct transactions electronically</li>
							<li>You are responsible for the authenticity and accuracy of documents you upload</li>
						</ul>
					</section>

					<section className="mb-8">
						<h2 className="text-2xl font-semibold text-white mb-4">
							5. Privacy and Data Protection
						</h2>
						<p className="text-gray-300 leading-relaxed mb-4">
							Your use of FomiqSign is also governed by our Privacy Policy. We take data protection
							seriously and implement industry-standard security measures to protect your documents
							and personal information.
						</p>
					</section>

					<section className="mb-8">
						<h2 className="text-2xl font-semibold text-white mb-4">6. Prohibited Uses</h2>
						<p className="text-gray-300 leading-relaxed mb-4">You may not use FomiqSign:</p>
						<ul className="list-disc pl-6 text-gray-300 space-y-2 mb-4">
							<li>For any unlawful purpose or to solicit others to perform unlawful acts</li>
							<li>
								To violate any international, federal, provincial, or state regulations, rules,
								laws, or local ordinances
							</li>
							<li>
								To infringe upon or violate our intellectual property rights or the intellectual
								property rights of others
							</li>
							<li>
								To harass, abuse, insult, harm, defame, slander, disparage, intimidate, or
								discriminate
							</li>
							<li>To upload or transmit viruses or any other type of malicious code</li>
							<li>To spam, phish, pharm, pretext, spider, crawl, or scrape</li>
						</ul>
					</section>

					<section className="mb-8">
						<h2 className="text-2xl font-semibold text-white mb-4">7. Service Availability</h2>
						<p className="text-gray-300 leading-relaxed mb-4">
							We strive to provide uninterrupted service but do not guarantee that FomiqSign will be
							available at all times. We reserve the right to modify, suspend, or discontinue the
							service at any time without notice.
						</p>
					</section>

					<section className="mb-8">
						<h2 className="text-2xl font-semibold text-white mb-4">8. Limitation of Liability</h2>
						<p className="text-gray-300 leading-relaxed mb-4">
							In no event shall FomiqSign or its suppliers be liable for any damages (including,
							without limitation, damages for loss of data or profit, or due to business
							interruption) arising out of the use or inability to use FomiqSign, even if we have
							been notified of the possibility of such damage.
						</p>
					</section>

					<section className="mb-8">
						<h2 className="text-2xl font-semibold text-white mb-4">9. Indemnification</h2>
						<p className="text-gray-300 leading-relaxed mb-4">
							You agree to indemnify, defend, and hold harmless FomiqSign and its affiliates from
							any claim or demand, including reasonable attorneys\u0027 fees, made by any third
							party due to or arising out of your breach of these Terms or your violation of any law
							or the rights of a third party.
						</p>
					</section>

					<section className="mb-8">
						<h2 className="text-2xl font-semibold text-white mb-4">10. Termination</h2>
						<p className="text-gray-300 leading-relaxed mb-4">
							We may terminate or suspend your account immediately, without prior notice or
							liability, for any reason whatsoever, including without limitation if you breach the
							Terms. Upon termination, your right to use the service will immediately cease.
						</p>
					</section>

					<section className="mb-8">
						<h2 className="text-2xl font-semibold text-white mb-4">11. Changes to Terms</h2>
						<p className="text-gray-300 leading-relaxed mb-4">
							We reserve the right to modify or replace these Terms at any time. If a revision is
							material, we will try to provide at least 30 days\u0027 notice prior to any new terms
							taking effect. What constitutes a material change will be determined at our sole
							discretion.
						</p>
					</section>

					<section className="mb-8">
						<h2 className="text-2xl font-semibold text-white mb-4">12. Governing Law</h2>
						<p className="text-gray-300 leading-relaxed mb-4">
							These Terms shall be governed and construed in accordance with applicable laws,
							without regard to its conflict of law provisions.
						</p>
					</section>

					<section className="mb-8">
						<h2 className="text-2xl font-semibold text-white mb-4">13. Contact Information</h2>
						<p className="text-gray-300 leading-relaxed mb-4">
							If you have any questions about these Terms, please contact us at:
						</p>
						<p className="text-gray-300 leading-relaxed">
							Email:{" "}
							<a href="mailto:support@fomiqsign.com" className="text-blue-400 hover:text-blue-300">
								support@fomiqsign.com
							</a>
						</p>
					</section>
				</div>

				<div className="mt-12 pt-8 border-t border-white/10">
					<p className="text-sm text-gray-400 text-center">
						By using FomiqSign, you acknowledge that you have read and understood these Terms of
						Service and agree to be bound by them.
					</p>
				</div>
			</div>
		</div>
	);
}
