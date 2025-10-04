"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { RegisterData } from "@/types/auth";

export default function Register() {
	const [formData, setFormData] = useState<RegisterData>({
		firstName: "",
		lastName: "",
		email: "",
		password: "",
		phoneNumber: "",
		company: "",
	});
	const [confirmPassword, setConfirmPassword] = useState("");
	const [acceptTerms, setAcceptTerms] = useState(false);

	const { register, isLoading } = useAuth();
	const router = useRouter();

	const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const { name, value } = e.target;
		setFormData((prev) => ({
			...prev,
			[name]: value,
		}));
	};

	const validateForm = (): boolean => {
		if (!formData.firstName.trim()) {
			toast.error("First name is required");
			return false;
		}
		if (!formData.lastName.trim()) {
			toast.error("Last name is required");
			return false;
		}
		if (!formData.email.trim()) {
			toast.error("Email is required");
			return false;
		}
		if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
			toast.error("Please enter a valid email address");
			return false;
		}
		if (formData.password.length < 8) {
			toast.error("Password must be at least 8 characters long");
			return false;
		}
		if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(formData.password)) {
			toast.error("Password must contain uppercase, lowercase, and numeric characters");
			return false;
		}
		if (formData.password !== confirmPassword) {
			toast.error("Passwords do not match");
			return false;
		}
		if (!acceptTerms) {
			toast.error("Please accept the terms and conditions");
			return false;
		}
		return true;
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();

		if (!validateForm()) return;

		try {
			const result = await register(formData);

			if (result.success) {
				toast.success("Registration successful! Welcome to DocuSign Platform.");
				router.push("/dashboard");
			} else {
				toast.error("Registration Failed", {
					description: result.message,
				});
			}
		} catch (error) {
			console.error("Registration error:", error);
			toast.error("Registration Failed", {
				description: "An unexpected error occurred. Please try again.",
			});
		}
	};

	return (
		<div className="min-h-screen bg-gradient-main flex items-center justify-center px-4">
			<div className="card w-full max-w-md">
				<div className="p-8">
					<div className="text-center mb-8">
						<h1 className="text-3xl font-bold text-white mb-2">Create Account</h1>
						<p className="text-white/70">Join DocuSign Integration Platform</p>
					</div>

					<form onSubmit={handleSubmit} className="space-y-6">
						<div className="grid grid-cols-2 gap-4">
							<div>
								<input
									type="text"
									name="firstName"
									placeholder="First Name"
									value={formData.firstName}
									onChange={handleInputChange}
									className="form-input w-full"
									required
									disabled={isLoading}
								/>
							</div>
							<div>
								<input
									type="text"
									name="lastName"
									placeholder="Last Name"
									value={formData.lastName}
									onChange={handleInputChange}
									className="form-input w-full"
									required
									disabled={isLoading}
								/>
							</div>
						</div>

						<div>
							<input
								type="email"
								name="email"
								placeholder="Email Address"
								value={formData.email}
								onChange={handleInputChange}
								className="form-input w-full"
								required
								disabled={isLoading}
							/>
						</div>

						<div>
							<input
								type="tel"
								name="phoneNumber"
								placeholder="Phone Number"
								value={formData.phoneNumber}
								onChange={handleInputChange}
								className="form-input w-full"
								disabled={isLoading}
							/>
						</div>

						<div>
							<input
								type="text"
								name="company"
								placeholder="Company Name"
								value={formData.company}
								onChange={handleInputChange}
								className="form-input w-full"
								disabled={isLoading}
							/>
						</div>

						<div>
							<input
								type="password"
								name="password"
								placeholder="Password"
								value={formData.password}
								onChange={handleInputChange}
								className="form-input w-full"
								required
								disabled={isLoading}
							/>
						</div>

						<div>
							<input
								type="password"
								placeholder="Confirm Password"
								value={confirmPassword}
								onChange={(e) => setConfirmPassword(e.target.value)}
								className="form-input w-full"
								required
								disabled={isLoading}
							/>
						</div>

						<div className="flex items-center">
							<input
								type="checkbox"
								id="acceptTerms"
								checked={acceptTerms}
								onChange={(e) => setAcceptTerms(e.target.checked)}
								className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
								required
								disabled={isLoading}
							/>
							<label htmlFor="acceptTerms" className="ml-2 text-sm text-white/80">
								I accept the{" "}
								<Link href="/terms" className="text-blue-400 hover:text-blue-300 underline">
									Terms of Service
								</Link>{" "}
								and{" "}
								<Link href="/privacy" className="text-blue-400 hover:text-blue-300 underline">
									Privacy Policy
								</Link>
							</label>
						</div>

						<button type="submit" disabled={isLoading} className="btn btn-primary w-full">
							{isLoading ? "Creating Account..." : "Create Account"}
						</button>
					</form>

					<div className="mt-6 text-center">
						<p className="text-white/70">
							Already have an account?{" "}
							<Link href="/login" className="text-blue-400 hover:text-blue-300 font-medium">
								Sign In
							</Link>
						</p>
					</div>
				</div>
			</div>
		</div>
	);
}
