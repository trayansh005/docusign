"use client";

import React, { useState } from "react";
import { toast } from "sonner";

interface ContactForm {
	name: string;
	email: string;
	subject: string;
	message: string;
	category: string;
}

export default function ContactClient() {
	const [formData, setFormData] = useState<ContactForm>({
		name: "",
		email: "",
		subject: "",
		message: "",
		category: "general",
	});
	const [isSubmitting, setIsSubmitting] = useState(false);

	const handleInputChange = (
		e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
	) => {
		const { name, value } = e.target;
		setFormData((prev) => ({
			...prev,
			[name]: value,
		}));
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setIsSubmitting(true);

		try {
			const response = await fetch("/api/contact", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify(formData),
			});

			const data = await response.json();

			if (data.success) {
				toast.success("Message sent successfully! We\u0027ll get back to you soon.");
				setFormData({
					name: "",
					email: "",
					subject: "",
					message: "",
					category: "general",
				});
			} else {
				toast.error(data.message || "Failed to send message. Please try again.");
			}
		} catch (error) {
			console.error("Contact form error:", error);
			toast.error("Failed to send message. Please try again.");
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8">
			<div className="max-w-7xl mx-auto">
				{/* Header */}
				<div className="text-center mb-12">
					<h1 className="text-4xl font-bold text-white mb-4">
						Contact <span className="text-gradient">Us</span>
					</h1>
					<p className="text-xl text-slate-300 max-w-2xl mx-auto">
						Have questions about FomiqSign? Need support? We\u0027re here to help you with all your
						document signing needs.
					</p>
				</div>

				<div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
					{/* Contact Information */}
					<div className="lg:col-span-2">
						<div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6">
							<h2 className="text-2xl font-semibold text-white mb-6">Get in Touch</h2>

							<div className="space-y-6">
								<div className="flex items-start space-x-4">
									<div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
										<svg
											className="w-5 h-5 text-blue-400"
											fill="none"
											stroke="currentColor"
											viewBox="0 0 24 24"
										>
											<path
												strokeLinecap="round"
												strokeLinejoin="round"
												strokeWidth={2}
												d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
											/>
										</svg>
									</div>
									<div>
										<h3 className="text-white font-medium">Email</h3>
										<p className="text-slate-300">support@fomiqsign.com</p>
									</div>
								</div>

								<div className="flex items-start space-x-4">
									<div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
										<svg
											className="w-5 h-5 text-green-400"
											fill="none"
											stroke="currentColor"
											viewBox="0 0 24 24"
										>
											<path
												strokeLinecap="round"
												strokeLinejoin="round"
												strokeWidth={2}
												d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
											/>
										</svg>
									</div>
									<div>
										<h3 className="text-white font-medium">Phone</h3>
										<p className="text-slate-300">+1 (555) 123-4567</p>
									</div>
								</div>

								<div className="flex items-start space-x-4">
									<div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
										<svg
											className="w-5 h-5 text-purple-400"
											fill="none"
											stroke="currentColor"
											viewBox="0 0 24 24"
										>
											<path
												strokeLinecap="round"
												strokeLinejoin="round"
												strokeWidth={2}
												d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
											/>
											<path
												strokeLinecap="round"
												strokeLinejoin="round"
												strokeWidth={2}
												d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
											/>
										</svg>
									</div>
									<div>
										<h3 className="text-white font-medium">Office</h3>
										<p className="text-slate-300">
											123 Tech Street
											<br />
											San Francisco, CA 94105
										</p>
									</div>
								</div>

								<div className="flex items-start space-x-4">
									<div className="w-10 h-10 bg-orange-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
										<svg
											className="w-5 h-5 text-orange-400"
											fill="none"
											stroke="currentColor"
											viewBox="0 0 24 24"
										>
											<path
												strokeLinecap="round"
												strokeLinejoin="round"
												strokeWidth={2}
												d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
											/>
										</svg>
									</div>
									<div>
										<h3 className="text-white font-medium">Business Hours</h3>
										<p className="text-slate-300">
											Mon - Fri: 9:00 AM - 6:00 PM PST
											<br />
											Sat - Sun: Closed
										</p>
									</div>
								</div>
							</div>
						</div>
					</div>

					{/* Contact Form */}
					<div className="lg:col-span-3">
						<div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-8">
							<h2 className="text-2xl font-semibold text-white mb-6">Send us a Message</h2>

							<form onSubmit={handleSubmit} className="space-y-6">
								<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
									<div>
										<label htmlFor="name" className="block text-sm font-medium text-slate-300 mb-2">
											Full Name *
										</label>
										<input
											type="text"
											id="name"
											name="name"
											required
											value={formData.name}
											onChange={handleInputChange}
											className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
											placeholder="Enter your full name"
										/>
									</div>

									<div>
										<label
											htmlFor="email"
											className="block text-sm font-medium text-slate-300 mb-2"
										>
											Email Address *
										</label>
										<input
											type="email"
											id="email"
											name="email"
											required
											value={formData.email}
											onChange={handleInputChange}
											className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
											placeholder="Enter your email address"
										/>
									</div>
								</div>

								<div>
									<label
										htmlFor="category"
										className="block text-sm font-medium text-slate-300 mb-2"
									>
										Category
									</label>
									<select
										id="category"
										name="category"
										value={formData.category}
										onChange={handleInputChange}
										className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
									>
										<option value="general">General Inquiry</option>
										<option value="support">Technical Support</option>
										<option value="billing">Billing & Subscriptions</option>
										<option value="feature">Feature Request</option>
										<option value="bug">Bug Report</option>
										<option value="partnership">Partnership</option>
									</select>
								</div>

								<div>
									<label
										htmlFor="subject"
										className="block text-sm font-medium text-slate-300 mb-2"
									>
										Subject *
									</label>
									<input
										type="text"
										id="subject"
										name="subject"
										required
										value={formData.subject}
										onChange={handleInputChange}
										className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
										placeholder="Brief description of your inquiry"
									/>
								</div>

								<div>
									<label
										htmlFor="message"
										className="block text-sm font-medium text-slate-300 mb-2"
									>
										Message *
									</label>
									<textarea
										id="message"
										name="message"
										required
										rows={6}
										value={formData.message}
										onChange={handleInputChange}
										className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 resize-none"
										placeholder="Please provide details about your inquiry..."
									/>
								</div>

								<button
									type="submit"
									disabled={isSubmitting}
									className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 disabled:from-gray-600 disabled:to-gray-600 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
								>
									{isSubmitting ? (
										<>
											<svg
												className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
												xmlns="http://www.w3.org/2000/svg"
												fill="none"
												viewBox="0 0 24 24"
											>
												<circle
													className="opacity-25"
													cx="12"
													cy="12"
													r="10"
													stroke="currentColor"
													strokeWidth="4"
												></circle>
												<path
													className="opacity-75"
													fill="currentColor"
													d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
												></path>
											</svg>
											<span>Sending...</span>
										</>
									) : (
										<>
											<svg
												className="w-5 h-5"
												fill="none"
												stroke="currentColor"
												viewBox="0 0 24 24"
											>
												<path
													strokeLinecap="round"
													strokeLinejoin="round"
													strokeWidth={2}
													d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
												/>
											</svg>
											<span>Send Message</span>
										</>
									)}
								</button>
							</form>
						</div>
					</div>
				</div>

				{/* FAQ Section */}
				<div className="mt-16">
					<div className="text-center mb-8">
						<h2 className="text-3xl font-bold text-white mb-4">
							Frequently Asked <span className="text-gradient">Questions</span>
						</h2>
						<p className="text-slate-300">
							Quick answers to common questions about FomiqSign Platform
						</p>
					</div>

					<div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
						<div className="bg-white/5 backdrop-blur-xl rounded-xl border border-white/10 p-6">
							<h3 className="text-lg font-semibold text-white mb-3">
								How secure is document signing?
							</h3>
							<p className="text-slate-300">
								We use industry-standard encryption and security protocols to ensure your documents
								are protected throughout the signing process.
							</p>
						</div>

						<div className="bg-white/5 backdrop-blur-xl rounded-xl border border-white/10 p-6">
							<h3 className="text-lg font-semibold text-white mb-3">
								Can I cancel my subscription anytime?
							</h3>
							<p className="text-slate-300">
								Yes, you can cancel your subscription at any time from your account settings. Your
								access will continue until the end of your billing period.
							</p>
						</div>

						<div className="bg-white/5 backdrop-blur-xl rounded-xl border border-white/10 p-6">
							<h3 className="text-lg font-semibold text-white mb-3">
								What file formats are supported?
							</h3>
							<p className="text-slate-300">
								We support PDF, DOC, DOCX, and most common document formats. Files are automatically
								converted for optimal signing experience.
							</p>
						</div>

						<div className="bg-white/5 backdrop-blur-xl rounded-xl border border-white/10 p-6">
							<h3 className="text-lg font-semibold text-white mb-3">
								How long does document processing take?
							</h3>
							<p className="text-slate-300">
								Most documents are processed instantly. Large files or complex documents may take a
								few minutes to prepare for signing.
							</p>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
