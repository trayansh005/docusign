"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { useAuthStore } from "@/stores/authStore";
import { LoginCredentials } from "@/types/auth";

export default function Login() {
	const [formData, setFormData] = useState<LoginCredentials>({
		email: "",
		password: "",
		userType: "user",
	});
	const [rememberMe, setRememberMe] = useState(false);

	const login = useAuthStore((state) => state.login);
	const isLoading = useAuthStore((state) => state.isLoading);
	const router = useRouter();

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();

		if (!formData.email || !formData.password) {
			toast.error("Validation Error", {
				description: "Email and password are required.",
			});
			return;
		}

		const result = await login(formData);

		if (result.success) {
			toast.success("Login Successful", {
				description: "Welcome back! Redirecting to your dashboard.",
			});
			setTimeout(() => router.push("/dashboard"), 1500);
		} else {
			toast.error("Login Failed", {
				description: result.message,
			});
		}
	};

	const handleInputChange = (field: keyof LoginCredentials, value: string) => {
		setFormData((prev) => ({ ...prev, [field]: value }));
	};

	return (
		<div className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
			<div className="max-w-md w-full">
				<div className="card fade-in shadow-2xl border-2 border-white/10 bg-slate-800/50">
					<div className="text-center mb-8">
						<div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-lg flex items-center justify-center mx-auto mb-4">
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
									d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
								/>
							</svg>
						</div>
						<h1 className="text-3xl font-bold mb-2">Welcome Back</h1>
						<p className="text-slate-300">Sign in to your account</p>
					</div>

					<form onSubmit={handleSubmit} className="space-y-6">
						<div>
							<label htmlFor="email" className="form-label text-white">
								Email Address
							</label>
							<input
								id="email"
								name="email"
								type="email"
								autoComplete="email"
								placeholder="Enter your email"
								value={formData.email}
								onChange={(e) => handleInputChange("email", e.target.value)}
								className="form-input"
								required
								disabled={isLoading}
							/>
						</div>

						<div>
							<label htmlFor="password" className="form-label text-white">
								Password
							</label>
							<input
								id="password"
								name="password"
								type="password"
								autoComplete="current-password"
								placeholder="Enter your password"
								value={formData.password}
								onChange={(e) => handleInputChange("password", e.target.value)}
								className="form-input"
								required
								disabled={isLoading}
							/>
						</div>

						<div className="flex items-center justify-between">
							<label className="flex items-center">
								<input
									type="checkbox"
									className="mr-2 accent-blue-500"
									checked={rememberMe}
									onChange={(e) => setRememberMe(e.target.checked)}
									disabled={isLoading}
								/>
								<span className="text-sm text-gray-200">Remember me</span>
							</label>
							<Link href="#" className="text-sm text-blue-400 hover:text-blue-300">
								Forgot password?
							</Link>
						</div>

						<button type="submit" disabled={isLoading} className="btn btn-primary w-full">
							{isLoading ? (
								<div className="flex items-center justify-center">
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
									Signing in...
								</div>
							) : (
								"Sign In"
							)}
						</button>
					</form>

					<div className="mt-8 text-center">
						<p className="text-gray-200">
							Don&apos;t have an account?{" "}
							<Link href="/register" className="text-blue-400 hover:text-blue-300 font-semibold">
								Create account
							</Link>
						</p>
					</div>
				</div>
			</div>
		</div>
	);
}
