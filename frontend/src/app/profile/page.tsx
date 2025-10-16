"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { useAuthStore } from "@/stores/authStore";

interface ProfileData {
	firstName: string;
	lastName: string;
	email: string;
	phoneNumber: string;
	company: string;
	currentPassword: string;
	newPassword: string;
	confirmPassword: string;
}

export default function Profile() {
	const user = useAuthStore((state) => state.user);
	const updateProfile = useAuthStore((state) => state.updateProfile);
	const changePassword = useAuthStore((state) => state.changePassword);
	const isLoading = useAuthStore((state) => state.isLoading);
	const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
	const router = useRouter();

	const [formData, setFormData] = useState<ProfileData>({
		firstName: "",
		lastName: "",
		email: "",
		phoneNumber: "",
		company: "",
		currentPassword: "",
		newPassword: "",
		confirmPassword: "",
	});

	const [activeTab, setActiveTab] = useState<"profile" | "password">("profile");
	const [isUpdating, setIsUpdating] = useState(false);

	// Auth guard - redirect to login if not authenticated
	useEffect(() => {
		if (!isLoading && !isAuthenticated) {
			router.replace("/login");
		}
	}, [isAuthenticated, isLoading, router]);

	useEffect(() => {
		if (user) {
			setFormData((prev) => ({
				...prev,
				firstName: user.firstName || "",
				lastName: user.lastName || "",
				email: user.email || "",
				phoneNumber: user.phoneNumber || "",
				company: user.company || "",
			}));
		}
	}, [user]);

	const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const { name, value } = e.target;
		setFormData((prev) => ({
			...prev,
			[name]: value,
		}));
	};

	const validateProfileForm = (): boolean => {
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
		return true;
	};

	const validatePasswordForm = (): boolean => {
		if (!formData.currentPassword) {
			toast.error("Current password is required");
			return false;
		}
		if (formData.newPassword.length < 8) {
			toast.error("New password must be at least 8 characters long");
			return false;
		}
		if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(formData.newPassword)) {
			toast.error("New password must contain uppercase, lowercase, and numeric characters");
			return false;
		}
		if (formData.newPassword !== formData.confirmPassword) {
			toast.error("New passwords do not match");
			return false;
		}
		return true;
	};

	const handleProfileSubmit = async (e: React.FormEvent) => {
		e.preventDefault();

		if (!validateProfileForm()) return;

		setIsUpdating(true);
		try {
			const profileData = {
				firstName: formData.firstName,
				lastName: formData.lastName,
				email: formData.email,
				phoneNumber: formData.phoneNumber,
				company: formData.company,
			};

			const result = await updateProfile(profileData);

			if (result.success) {
				toast.success("Profile updated successfully!");
			} else {
				toast.error("Failed to update profile", {
					description: result.message,
				});
			}
		} catch (error) {
			console.error("Profile update error:", error);
			toast.error("Failed to update profile", {
				description: "An unexpected error occurred. Please try again.",
			});
		} finally {
			setIsUpdating(false);
		}
	};

	const handlePasswordSubmit = async (e: React.FormEvent) => {
		e.preventDefault();

		if (!validatePasswordForm()) return;

		setIsUpdating(true);
		try {
			const result = await changePassword({
				currentPassword: formData.currentPassword,
				newPassword: formData.newPassword,
			});

			if (result.success) {
				toast.success("Password updated successfully!");
				setFormData((prev) => ({
					...prev,
					currentPassword: "",
					newPassword: "",
					confirmPassword: "",
				}));
			} else {
				toast.error("Failed to update password", {
					description: result.message,
				});
			}
		} catch (error) {
			console.error("Password update error:", error);
			toast.error("Failed to update password", {
				description: "An unexpected error occurred. Please try again.",
			});
		} finally {
			setIsUpdating(false);
		}
	};

	if (isLoading) {
		return (
			<div className="min-h-screen flex items-center justify-center">
				<div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500"></div>
			</div>
		);
	}

	return (
		<div className="min-h-screen py-8 px-4 sm:px-6 lg:px-8">
			<div className="max-w-6xl mx-auto">
				{/* Header */}
				<div className="mb-8">
					<div className="flex items-center justify-between">
						<div>
							<h1 className="text-3xl font-bold text-white mb-2">Profile Settings</h1>
							<p className="text-gray-400">Manage your account information and preferences</p>
						</div>
						<Link href="/dashboard" className="btn btn-secondary">
							← Back to Dashboard
						</Link>
					</div>
				</div>

				<div className="grid grid-cols-1 lg:grid-cols-5 gap-12">
					{/* Sidebar */}
					<div className="lg:col-span-1">
						<div className="card p-6">
							<div className="flex flex-col space-y-2">
								<button
									onClick={() => setActiveTab("profile")}
									className={`text-left px-4 py-2 rounded-lg transition-colors ${
										activeTab === "profile"
											? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
											: "text-gray-400 hover:text-white hover:bg-gray-800/50"
									}`}
								>
									<div className="flex items-center">
										<svg
											className="w-5 h-5 mr-3"
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
										Profile Information
									</div>
								</button>
								<button
									onClick={() => setActiveTab("password")}
									className={`text-left px-4 py-2 rounded-lg transition-colors ${
										activeTab === "password"
											? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
											: "text-gray-400 hover:text-white hover:bg-gray-800/50"
									}`}
								>
									<div className="flex items-center">
										<svg
											className="w-5 h-5 mr-3"
											fill="none"
											stroke="currentColor"
											viewBox="0 0 24 24"
										>
											<path
												strokeLinecap="round"
												strokeLinejoin="round"
												strokeWidth={2}
												d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
											/>
										</svg>
										Change Password
									</div>
								</button>
							</div>
						</div>
					</div>

					{/* Main Content */}
					<div className="lg:col-span-4">
						<div className="card p-10">
							{activeTab === "profile" && (
								<div>
									<h2 className="text-2xl font-bold text-white mb-6">Profile Information</h2>
									<form onSubmit={handleProfileSubmit} className="space-y-6">
										<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
											<div>
												<label htmlFor="firstName" className="form-label text-white">
													First Name
												</label>
												<input
													type="text"
													id="firstName"
													name="firstName"
													value={formData.firstName}
													onChange={handleInputChange}
													className="form-input"
													required
													disabled={isUpdating}
												/>
											</div>
											<div>
												<label htmlFor="lastName" className="form-label text-white">
													Last Name
												</label>
												<input
													type="text"
													id="lastName"
													name="lastName"
													value={formData.lastName}
													onChange={handleInputChange}
													className="form-input"
													required
													disabled={isUpdating}
												/>
											</div>
										</div>

										<div>
											<label htmlFor="email" className="form-label text-white">
												Email Address
											</label>
											<input
												type="email"
												id="email"
												name="email"
												value={formData.email}
												onChange={handleInputChange}
												className="form-input"
												required
												disabled={isUpdating}
											/>
										</div>

										<div>
											<label htmlFor="phoneNumber" className="form-label text-white">
												Phone Number
											</label>
											<input
												type="tel"
												id="phoneNumber"
												name="phoneNumber"
												value={formData.phoneNumber}
												onChange={handleInputChange}
												className="form-input"
												disabled={isUpdating}
											/>
										</div>

										<div>
											<label htmlFor="company" className="form-label text-white">
												Company
											</label>
											<input
												type="text"
												id="company"
												name="company"
												value={formData.company}
												onChange={handleInputChange}
												className="form-input"
												disabled={isUpdating}
											/>
										</div>

										<div className="flex justify-end">
											<button type="submit" disabled={isUpdating} className="btn btn-primary">
												{isUpdating ? "Updating..." : "Update Profile"}
											</button>
										</div>
									</form>
								</div>
							)}

							{activeTab === "password" && (
								<div>
									<h2 className="text-2xl font-bold text-white mb-6">Change Password</h2>
									<form onSubmit={handlePasswordSubmit} className="space-y-6">
										<div>
											<label htmlFor="currentPassword" className="form-label">
												Current Password
											</label>
											<input
												type="password"
												id="currentPassword"
												name="currentPassword"
												value={formData.currentPassword}
												onChange={handleInputChange}
												className="form-input"
												required
												disabled={isUpdating}
											/>
										</div>

										<div>
											<label htmlFor="newPassword" className="form-label">
												New Password
											</label>
											<input
												type="password"
												id="newPassword"
												name="newPassword"
												value={formData.newPassword}
												onChange={handleInputChange}
												className="form-input"
												required
												disabled={isUpdating}
											/>
											<p className="text-sm text-gray-400 mt-1">
												Password must be at least 8 characters with uppercase, lowercase, and
												numbers
											</p>
										</div>

										<div>
											<label htmlFor="confirmPassword" className="form-label">
												Confirm New Password
											</label>
											<input
												type="password"
												id="confirmPassword"
												name="confirmPassword"
												value={formData.confirmPassword}
												onChange={handleInputChange}
												className="form-input"
												required
												disabled={isUpdating}
											/>
										</div>

										<div className="flex justify-end">
											<button type="submit" disabled={isUpdating} className="btn btn-primary">
												{isUpdating ? "Updating..." : "Change Password"}
											</button>
										</div>
									</form>
								</div>
							)}
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
